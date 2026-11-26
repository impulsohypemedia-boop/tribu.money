-- A room is a tribu (shared expenses) or a vaquita (one shared pot).
ALTER TABLE "split"."Room" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'tribu';
