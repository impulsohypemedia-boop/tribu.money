-- Tribu accounts: the email a person signed in with, so "Tu cuenta" can show who is in.
ALTER TABLE "split"."User" ADD COLUMN "email" TEXT;
ALTER TABLE "split"."User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
CREATE INDEX "Member_userId_idx" ON "split"."Member"("userId");
