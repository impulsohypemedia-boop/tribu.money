-- Payout details a member types for themself, and the honored-guest flag.
ALTER TABLE "split"."Member" ADD COLUMN "payoutToken" TEXT;
ALTER TABLE "split"."Member" ADD COLUMN "payoutNetwork" TEXT;
ALTER TABLE "split"."Member" ADD COLUMN "payoutAddress" TEXT;
ALTER TABLE "split"."Member" ADD COLUMN "honoredGuest" BOOLEAN NOT NULL DEFAULT false;
