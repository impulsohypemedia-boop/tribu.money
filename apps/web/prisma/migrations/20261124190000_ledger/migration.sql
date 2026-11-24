-- The tribu's book of account. Append-only, double-entry, room-currency minor units.
-- Existing expenses, payments and pot contributions are copied in as one record each.
-- Nothing already in the database is changed.

CREATE TABLE "split"."LedgerEntry" (
    "id" BIGSERIAL NOT NULL,
    "roomId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reversesId" BIGINT,
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "detail" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LedgerEntry_sourceType_check" CHECK ("sourceType" IN ('expense', 'settlement', 'pot_contribution')),
    CONSTRAINT "LedgerEntry_kind_check" CHECK (
        ("kind" = 'record' AND "reversesId" IS NULL) OR ("kind" = 'reversal' AND "reversesId" IS NOT NULL)
    )
);

CREATE TABLE "split"."LedgerPosting" (
    "id" BIGSERIAL NOT NULL,
    "entryId" BIGINT NOT NULL,
    "roomId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,

    CONSTRAINT "LedgerPosting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LedgerPosting_accountType_check" CHECK ("accountType" IN ('member', 'pot', 'keeper'))
);

CREATE UNIQUE INDEX "LedgerEntry_reversesId_key" ON "split"."LedgerEntry"("reversesId");
CREATE INDEX "LedgerEntry_roomId_id_idx" ON "split"."LedgerEntry"("roomId", "id");
CREATE INDEX "LedgerEntry_roomId_sourceType_sourceId_idx" ON "split"."LedgerEntry"("roomId", "sourceType", "sourceId");
CREATE INDEX "LedgerPosting_entryId_idx" ON "split"."LedgerPosting"("entryId");
CREATE INDEX "LedgerPosting_roomId_accountType_accountId_idx" ON "split"."LedgerPosting"("roomId", "accountType", "accountId");

ALTER TABLE "split"."LedgerEntry"
ADD CONSTRAINT "LedgerEntry_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "split"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "split"."LedgerEntry"
ADD CONSTRAINT "LedgerEntry_reversesId_fkey"
FOREIGN KEY ("reversesId") REFERENCES "split"."LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "split"."LedgerPosting"
ADD CONSTRAINT "LedgerPosting_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "split"."LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nothing in the book can be edited or removed, even if application code regresses.
CREATE FUNCTION "split"."prevent_ledger_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'the ledger is append-only: add a reversal instead';
END;
$$;

CREATE TRIGGER "LedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "split"."LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "split"."prevent_ledger_mutation"();

CREATE TRIGGER "LedgerPosting_append_only"
BEFORE UPDATE OR DELETE ON "split"."LedgerPosting"
FOR EACH ROW EXECUTE FUNCTION "split"."prevent_ledger_mutation"();

-- Every entry must balance. Checked at commit, once all of its postings are in.
CREATE FUNCTION "split"."check_ledger_entry_balances"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    total NUMERIC;
BEGIN
    SELECT COALESCE(SUM("amountMinor"), 0) INTO total
    FROM "split"."LedgerPosting" WHERE "entryId" = NEW."entryId";
    IF total <> 0 THEN
        RAISE EXCEPTION 'ledger entry % does not balance (off by %)', NEW."entryId", total;
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "LedgerPosting_entry_balances"
AFTER INSERT ON "split"."LedgerPosting"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "split"."check_ledger_entry_balances"();

-- Backfill: one record for every expense, payment and pot contribution that is live today.

INSERT INTO "split"."LedgerEntry" ("roomId", "sourceType", "sourceId", "kind", "currency", "description", "detail", "occurredAt")
SELECT
    e."roomId", 'expense', e."id", 'record', r."currency", e."description",
    jsonb_build_object(
        'amountMinor', e."amountMinor"::text,
        'currency', e."currency",
        'paidById', e."paidById",
        'category', e."category",
        'potId', e."potId"
    ),
    e."date"
FROM "split"."Expense" e
JOIN "split"."Room" r ON r."id" = e."roomId"
WHERE e."deletedAt" IS NULL
ORDER BY e."createdAt", e."id";

INSERT INTO "split"."LedgerEntry" ("roomId", "sourceType", "sourceId", "kind", "currency", "description", "detail", "occurredAt")
SELECT
    s."roomId", 'settlement', s."id", 'record', r."currency", s."note",
    jsonb_build_object('fromId', s."fromId", 'toId', s."toId", 'method', s."method"),
    s."createdAt"
FROM "split"."Settlement" s
JOIN "split"."Room" r ON r."id" = s."roomId"
WHERE s."deletedAt" IS NULL
ORDER BY s."createdAt", s."id";

INSERT INTO "split"."LedgerEntry" ("roomId", "sourceType", "sourceId", "kind", "currency", "description", "detail", "occurredAt")
SELECT
    p."roomId", 'pot_contribution', c."id", 'record', r."currency", p."name",
    jsonb_build_object('potId', p."id", 'memberId', c."memberId", 'keeperId', p."keeperId", 'reason', c."reason"),
    c."createdAt"
FROM "split"."PotContribution" c
JOIN "split"."Pot" p ON p."id" = c."potId"
JOIN "split"."Room" r ON r."id" = p."roomId"
WHERE c."deletedAt" IS NULL
ORDER BY c."createdAt", c."id";

-- All postings go in one statement, so every entry balances when the deferred check runs.
INSERT INTO "split"."LedgerPosting" ("entryId", "roomId", "accountType", "accountId", "amountMinor")
SELECT le."id", le."roomId", lines."accountType", lines."accountId", lines."amountMinor"
FROM "split"."LedgerEntry" le
JOIN (
    -- the payer put the money in
    SELECT 'expense' AS "sourceType", e."id" AS "sourceId", 'member' AS "accountType", e."paidById" AS "accountId", e."baseAmountMinor" AS "amountMinor"
    FROM "split"."Expense" e WHERE e."deletedAt" IS NULL
    UNION ALL
    -- each person's part of it
    SELECT 'expense', e."id", 'member', sh."memberId", -sh."amountMinor"
    FROM "split"."Expense" e JOIN "split"."ExpenseShare" sh ON sh."expenseId" = e."id"
    WHERE e."deletedAt" IS NULL
    UNION ALL
    -- paid from a vaquita: the money left the pot, out of the keeper's hands
    SELECT 'expense', e."id", 'pot', e."potId", -e."baseAmountMinor"
    FROM "split"."Expense" e JOIN "split"."Pot" p ON p."id" = e."potId" AND p."keeperId" = e."paidById"
    WHERE e."deletedAt" IS NULL
    UNION ALL
    SELECT 'expense', e."id", 'keeper', e."paidById", e."baseAmountMinor"
    FROM "split"."Expense" e JOIN "split"."Pot" p ON p."id" = e."potId" AND p."keeperId" = e."paidById"
    WHERE e."deletedAt" IS NULL
    UNION ALL
    SELECT 'settlement', s."id", 'member', s."fromId", s."amountMinor"
    FROM "split"."Settlement" s WHERE s."deletedAt" IS NULL
    UNION ALL
    SELECT 'settlement', s."id", 'member', s."toId", -s."amountMinor"
    FROM "split"."Settlement" s WHERE s."deletedAt" IS NULL
    UNION ALL
    SELECT 'pot_contribution', c."id", 'pot', c."potId", c."amountMinor"
    FROM "split"."PotContribution" c WHERE c."deletedAt" IS NULL
    UNION ALL
    SELECT 'pot_contribution', c."id", 'keeper', p."keeperId", -c."amountMinor"
    FROM "split"."PotContribution" c JOIN "split"."Pot" p ON p."id" = c."potId"
    WHERE c."deletedAt" IS NULL
) lines ON lines."sourceType" = le."sourceType" AND lines."sourceId" = le."sourceId";
