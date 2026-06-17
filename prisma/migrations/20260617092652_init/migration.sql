-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'EVERY_N_DAYS');

-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('FIXED', 'ROTATION');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "House" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "haUserId" TEXT NOT NULL,
    "haPersonEntityId" TEXT,
    "displayName" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'mdi:broom',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "estMinutes" INTEGER NOT NULL DEFAULT 10,
    "points" INTEGER NOT NULL DEFAULT 10,
    "frequency" "Frequency" NOT NULL,
    "everyNDays" INTEGER,
    "assignmentMode" "AssignmentMode" NOT NULL DEFAULT 'ROTATION',
    "assignedMemberId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskOccurrence" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "assignedMemberId" TEXT,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "completedByMemberId" TEXT,
    "haEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_haUserId_key" ON "Member"("haUserId");

-- CreateIndex
CREATE INDEX "Member_houseId_idx" ON "Member"("houseId");

-- CreateIndex
CREATE INDEX "Room_houseId_idx" ON "Room"("houseId");

-- CreateIndex
CREATE INDEX "Task_houseId_idx" ON "Task"("houseId");

-- CreateIndex
CREATE INDEX "Task_roomId_idx" ON "Task"("roomId");

-- CreateIndex
CREATE INDEX "TaskOccurrence_houseId_dueDate_status_idx" ON "TaskOccurrence"("houseId", "dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskOccurrence_taskId_dueDate_key" ON "TaskOccurrence"("taskId", "dueDate");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_completedByMemberId_fkey" FOREIGN KEY ("completedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
