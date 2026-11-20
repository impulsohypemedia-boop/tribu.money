-- Network of a stablecoin payment recorded by hand (method "crypto").
ALTER TABLE "split"."Settlement" ADD COLUMN "network" TEXT;
