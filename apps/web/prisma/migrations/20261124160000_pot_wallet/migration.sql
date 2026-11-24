-- La vaquita as a real wallet: where a pot's money sits in the TribuVaquita contract.
ALTER TABLE "split"."Pot" ADD COLUMN "walletPotId" TEXT, ADD COLUMN "walletToken" TEXT;
CREATE UNIQUE INDEX "Pot_walletPotId_key" ON "split"."Pot"("walletPotId");

CREATE TABLE "split"."PotWalletNote" (
    "id" TEXT NOT NULL,
    "potId" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PotWalletNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PotWalletNote_memo_key" ON "split"."PotWalletNote"("memo");
CREATE INDEX "PotWalletNote_potId_idx" ON "split"."PotWalletNote"("potId");
ALTER TABLE "split"."PotWalletNote" ADD CONSTRAINT "PotWalletNote_potId_fkey" FOREIGN KEY ("potId") REFERENCES "split"."Pot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
