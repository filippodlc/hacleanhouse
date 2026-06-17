-- Occorrenze "rule + eccezioni": TaskOccurrence diventa tabella di sole eccezioni.
-- Identità = lo slot di cadenza (cadenceDate), non la data mostrata (dueDate).

-- 1. Nuova colonna identità, backfill dal dueDate esistente (le righe attuali sono on-cadence), poi NOT NULL.
ALTER TABLE "TaskOccurrence" ADD COLUMN "cadenceDate" DATE;
UPDATE "TaskOccurrence" SET "cadenceDate" = "dueDate";
ALTER TABLE "TaskOccurrence" ALTER COLUMN "cadenceDate" SET NOT NULL;

-- 2. Sposta l'unique da (taskId, dueDate) a (taskId, cadenceDate).
DROP INDEX "TaskOccurrence_taskId_dueDate_key";
CREATE UNIQUE INDEX "TaskOccurrence_taskId_cadenceDate_key" ON "TaskOccurrence"("taskId", "cadenceDate");

-- 3. Elimina le righe "default" (PENDING senza stato calendario): erano solo
--    l'orizzonte mobile pregresso. Conserva storico DONE/SKIPPED e stato calendario.
DELETE FROM "TaskOccurrence"
WHERE "status" = 'PENDING' AND "haEventId" IS NULL AND "calendarRemoved" = false;
