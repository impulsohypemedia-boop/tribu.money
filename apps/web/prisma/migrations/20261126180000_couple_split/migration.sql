-- Tribu de pareja: the couple's default split for new expenses. Nullable, so older code ignores it.
ALTER TABLE "split"."Room" ADD COLUMN "coupleSplit" JSONB;
