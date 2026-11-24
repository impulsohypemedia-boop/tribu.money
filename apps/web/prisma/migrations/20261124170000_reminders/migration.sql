-- Recordatorio amable: someone who is owed money nudges the person who owes it.
CREATE TABLE "split"."Reminder" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Reminder_roomId_toId_createdAt_idx" ON "split"."Reminder"("roomId", "toId", "createdAt");
ALTER TABLE "split"."Reminder" ADD CONSTRAINT "Reminder_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "split"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
