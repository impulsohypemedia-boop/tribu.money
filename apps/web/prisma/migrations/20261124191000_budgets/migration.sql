-- Presupuesto del grupo: a monthly spending limit per tribu, overall or per category.
CREATE TABLE "split"."Budget" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Budget_roomId_category_key" ON "split"."Budget"("roomId", "category");
ALTER TABLE "split"."Budget" ADD CONSTRAINT "Budget_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "split"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
