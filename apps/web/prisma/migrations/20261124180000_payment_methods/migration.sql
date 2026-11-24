-- More ways to be paid, typed by each member: a bank alias or CBU/CVU, and a Lemon tag.
ALTER TABLE "split"."Member" ADD COLUMN "payoutBank" TEXT;
ALTER TABLE "split"."Member" ADD COLUMN "payoutLemonTag" TEXT;
