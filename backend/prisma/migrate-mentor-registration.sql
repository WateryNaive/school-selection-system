BEGIN;
ALTER TABLE "Mentor" ADD COLUMN IF NOT EXISTS "registered" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Mentor" SET "registered" = true WHERE "id" LIKE 'm-%';
COMMIT;
