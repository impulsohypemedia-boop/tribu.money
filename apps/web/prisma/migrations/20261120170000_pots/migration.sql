-- La vaquita: shared pots kept in one member's account.
CREATE TABLE "split"."Pot" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keeperId" TEXT NOT NULL,
    "targetMinor" BIGINT,
    "quotaMinor" BIGINT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "Pot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Pot_roomId_idx" ON "split"."Pot"("roomId");
ALTER TABLE "split"."Pot" ADD CONSTRAINT "Pot_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "split"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "split"."PotContribution" (
    "id" TEXT NOT NULL,
    "potId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "settlementId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PotContribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PotContribution_settlementId_key" ON "split"."PotContribution"("settlementId");
CREATE INDEX "PotContribution_potId_idx" ON "split"."PotContribution"("potId");
ALTER TABLE "split"."PotContribution" ADD CONSTRAINT "PotContribution_potId_fkey"
    FOREIGN KEY ("potId") REFERENCES "split"."Pot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "split"."Expense" ADD COLUMN "potId" TEXT;
