-- AlterTable: ruolo admin sui membri (gating gestione membri).
ALTER TABLE "Member" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Bootstrap retroattivo: promuove il membro più vecchio di ogni casa ad admin,
-- così le installazioni esistenti mantengono almeno un amministratore.
UPDATE "Member" m
SET "isAdmin" = true
FROM (
  SELECT DISTINCT ON ("houseId") "id"
  FROM "Member"
  ORDER BY "houseId", "createdAt" ASC
) first
WHERE m."id" = first."id";
