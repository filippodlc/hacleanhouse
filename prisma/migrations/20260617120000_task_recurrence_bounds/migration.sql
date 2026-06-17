-- Ricorrenze stile Google Calendar: data di inizio, fine (count o data), serie per gli split.

-- 1. Colonne nuove (nullable per consentire il backfill).
ALTER TABLE "Task" ADD COLUMN "startDate" DATE;
ALTER TABLE "Task" ADD COLUMN "repeatCount" INTEGER;
ALTER TABLE "Task" ADD COLUMN "endDate" DATE;
ALTER TABLE "Task" ADD COLUMN "seriesId" TEXT;

-- 2. Backfill: i task esistenti restano "infiniti" (repeatCount/endDate NULL),
--    ancorati alla loro data di creazione; seriesId = id (serie singola).
UPDATE "Task" SET "startDate" = "createdAt"::date WHERE "startDate" IS NULL;
UPDATE "Task" SET "seriesId" = "id" WHERE "seriesId" IS NULL;

-- 3. startDate è obbligatoria d'ora in poi.
ALTER TABLE "Task" ALTER COLUMN "startDate" SET NOT NULL;

-- 4. Indice per il raggruppamento dei tronconi di una serie.
CREATE INDEX "Task_seriesId_idx" ON "Task"("seriesId");
