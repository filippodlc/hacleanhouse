import { prisma } from "@/lib/db";
import type { OccCtx } from "@/lib/occurrences";
import { AssignmentMode } from "@prisma/client";
import "server-only";

export const SUMMARY = (name: string, assignees: string[] = []) =>
  `🧹 ${name}${assignees.length ? ` — ${assignees.join(", ")}` : ""}`;

export const DESCRIPTION = (room: string) => `Pulizie — ${room}`;

/**
 * Nomi degli assegnatari di un'intera serie per il titolo dell'evento ricorrente:
 * FIXED → gli assegnatari fissi; ROTATION → tutti i membri della casa (il titolo
 * della serie non può riflettere il singolo turno, quindi li elenca tutti).
 */
export async function seriesAssigneeNames(task: {
  houseId: string;
  assignmentMode: AssignmentMode;
  assignees: { displayName: string }[];
}): Promise<string[]> {
  if (task.assignmentMode === AssignmentMode.FIXED) {
    return task.assignees.map((a) => a.displayName);
  }
  const members = await prisma.member.findMany({
    where: { houseId: task.houseId },
    orderBy: { createdAt: "asc" },
    select: { displayName: true },
  });
  return members.map((m) => m.displayName);
}

/** Nomi degli assegnatari di una singola occorrenza (per gli eventi standalone). */
export function occurrenceAssigneeNames(occ: OccCtx): string[] {
  if (occ.task.assignmentMode === AssignmentMode.FIXED) {
    return occ.task.assignees.map((a) => a.displayName);
  }
  return occ.assignedMember ? [occ.assignedMember.displayName] : [];
}
