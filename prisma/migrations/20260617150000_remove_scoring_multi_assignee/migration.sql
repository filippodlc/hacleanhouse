-- Relazione many-to-many Task <-> Member per gli assegnatari fissi (FIXED).
-- CreateTable
CREATE TABLE "_TaskAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");

-- AddForeignKey ("A" = Member.id, "B" = Task.id)
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: porta gli assegnatari FIXED esistenti (singolo) nella nuova relazione,
-- prima di rimuovere la colonna assignedMemberId.
INSERT INTO "_TaskAssignees" ("A", "B")
SELECT "assignedMemberId", "id" FROM "Task" WHERE "assignedMemberId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assignedMemberId_fkey";

-- Rimozione del punteggio (concetto eliminato dall'app).
-- AlterTable
ALTER TABLE "Member" DROP COLUMN "coins";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "assignedMemberId",
DROP COLUMN "points";
