-- Monthly shared expenses.
CREATE TABLE "split"."RecurringExpense" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "nextMonth" TEXT NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecurringExpense_roomId_idx" ON "split"."RecurringExpense"("roomId");
ALTER TABLE "split"."RecurringExpense" ADD CONSTRAINT "RecurringExpense_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "split"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "split"."Expense" ADD COLUMN "recurringId" TEXT;
