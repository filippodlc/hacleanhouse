-- Calendario: un singolo evento ricorrente per serie (al posto di eventi singoli).

-- uid (iCal) dell'evento ricorrente sul calendario HA, salvato sul Task (la serie).
ALTER TABLE "Task" ADD COLUMN "haEventId" TEXT;

-- Flag: l'occorrenza è stata rimossa come istanza dalla serie sul calendario.
ALTER TABLE "TaskOccurrence" ADD COLUMN "calendarRemoved" BOOLEAN NOT NULL DEFAULT false;
