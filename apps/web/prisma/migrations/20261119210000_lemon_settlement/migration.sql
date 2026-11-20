-- Lemon wallets on members and on-chain proof on settlements.
ALTER TABLE "split"."Member" ADD COLUMN "walletAddress" TEXT;
ALTER TABLE "split"."Member" ADD COLUMN "lemonTag" TEXT;
ALTER TABLE "split"."Member" ADD COLUMN "walletLinkedAt" TIMESTAMP(3);

ALTER TABLE "split"."Settlement" ADD COLUMN "txHash" TEXT;
ALTER TABLE "split"."Settlement" ADD COLUMN "chainId" INTEGER;
ALTER TABLE "split"."Settlement" ADD COLUMN "token" TEXT;
ALTER TABLE "split"."Settlement" ADD COLUMN "tokenAmount" TEXT;

CREATE UNIQUE INDEX "Settlement_txHash_key" ON "split"."Settlement"("txHash");
