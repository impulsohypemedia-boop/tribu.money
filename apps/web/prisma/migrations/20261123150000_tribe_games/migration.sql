-- La vaquita que rinde, redondeo, ruleta, apuestas y multas.
ALTER TABLE "split"."Pot" ADD COLUMN "yieldAprBps" INTEGER;
ALTER TABLE "split"."PotContribution" ADD COLUMN "reason" TEXT;

CREATE TABLE "split"."Draw" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "seedHash" TEXT NOT NULL,
    "clientSeed" TEXT,
    "participantIds" TEXT[],
    "paidById" TEXT,
    "amountMinor" BIGINT,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spunAt" TIMESTAMP(3),
    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Draw_roomId_idx" ON "split"."Draw"("roomId");
ALTER TABLE "split"."Draw" ADD CONSTRAINT "Draw_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "split"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "split"."Bet" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "rivalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "claimedWinnerId" TEXT,
    "claimedById" TEXT,
    "winnerId" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Bet_roomId_idx" ON "split"."Bet"("roomId");
ALTER TABLE "split"."Bet" ADD CONSTRAINT "Bet_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "split"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "split"."Fine" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "proposedById" TEXT,
    "votes" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'voting',
    "contributionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "Fine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Fine_roomId_idx" ON "split"."Fine"("roomId");
ALTER TABLE "split"."Fine" ADD CONSTRAINT "Fine_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "split"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
