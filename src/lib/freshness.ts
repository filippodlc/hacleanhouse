import { prisma } from "@/lib/db";
import { MS_PER_DAY, dateOnlyUTC, diffDays, isoDate } from "@/lib/dates";
import { firstCadenceOnOrAfter, frequencyIntervalDays, nextCadenceAfter } from "@/lib/occurrences";
import { OccurrenceStatus } from "@prisma/client";
import "server-only";

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}


export type TaskFreshnessVM = {
  taskId: string;
  taskName: string;
  /** 0 = a scadenza/sporco, 1 = appena pulito. */
  freshness: number;
  lastCleanISO: string | null;
  nextDueISO: string;
  intervalDays: number;
  /** Giorni di ritardo oltre la scadenza (0 se non in ritardo). */
  overdueDays: number;
};

export type RoomFreshnessVM = {
  roomId: string;
  roomName: string;
  roomIcon: string;
  /** Media della freschezza dei task della stanza. */
  freshness: number;
  tasks: TaskFreshnessVM[];
};

/**
 * Stato di pulizia per stanza: per ogni task attivo calcola quanto è "fresca"
 * l'ultima pulizia rispetto al suo intervallo (1 appena pulito → 0 a scadenza),
 * poi media per stanza. Le occorrenze sono virtuali: l'ultima pulizia è la
 * `TaskOccurrence` DONE più recente (la tabella sparsa conserva i DONE).
 */
export async function listRoomFreshness(opts: {
  houseId: string;
}): Promise<RoomFreshnessVM[]> {
  const today = dateOnlyUTC(new Date());

  const [rooms, tasks, dones] = await Promise.all([
    prisma.room.findMany({
      where: { houseId: opts.houseId },
      orderBy: { order: "asc" },
    }),
    prisma.task.findMany({
      where: { houseId: opts.houseId, active: true },
    }),
    prisma.taskOccurrence.findMany({
      where: { houseId: opts.houseId, status: OccurrenceStatus.DONE },
      select: { taskId: true, cadenceDate: true, completedAt: true },
    }),
  ]);

  // Ultimo DONE per task (per cadenceDate più recente).
  const lastDoneByTask = new Map<string, { cadenceDate: Date; completedAt: Date | null }>();
  for (const d of dones) {
    const cur = lastDoneByTask.get(d.taskId);
    if (!cur || d.cadenceDate.getTime() > cur.cadenceDate.getTime()) {
      lastDoneByTask.set(d.taskId, { cadenceDate: d.cadenceDate, completedAt: d.completedAt });
    }
  }

  const tasksByRoom = new Map<string, TaskFreshnessVM[]>();

  for (const task of tasks) {
    const lastDone = lastDoneByTask.get(task.id);

    let anchor: Date;
    let nextDue: Date | null;
    if (lastDone) {
      // Con storico: barra piena alla data REALE di esecuzione (non allo slot
      // programmato), vuota alla prima cadenza successiva a quella data. Così
      // spuntare un task in ritardo lo riporta a pieno e riparte da lì.
      const doneDate = dateOnlyUTC(lastDone.completedAt ?? lastDone.cadenceDate);
      anchor = doneDate;
      nextDue = nextCadenceAfter(task, doneDate);
    } else {
      // Senza storico: la scadenza è la prima cadenza non soddisfatta (la più
      // vecchia). Una ricorrenza dovuta oggi e mai fatta = sporca (barra ~vuota);
      // se la scadenza è già passata diventa arretrata. Ancora "piena" un
      // intervallo prima della scadenza.
      nextDue = firstCadenceOnOrAfter(task, task.startDate);
      if (!nextDue) continue;
      anchor = new Date(nextDue.getTime() - frequencyIntervalDays(task) * MS_PER_DAY);
    }
    // Serie finita (repeatCount/endDate esauriti): niente più scadenze → escluso.
    if (!nextDue) continue;

    const denom = Math.max(1, diffDays(nextDue, anchor));
    const remaining = diffDays(nextDue, today);
    const freshness = clamp01(remaining / denom);
    const overdueDays = today.getTime() > nextDue.getTime() ? diffDays(today, nextDue) : 0;

    const vm: TaskFreshnessVM = {
      taskId: task.id,
      taskName: task.name,
      freshness,
      lastCleanISO: lastDone ? isoDate(lastDone.completedAt ?? lastDone.cadenceDate) : null,
      nextDueISO: isoDate(nextDue),
      intervalDays: denom,
      overdueDays,
    };

    const list = tasksByRoom.get(task.roomId) ?? [];
    list.push(vm);
    tasksByRoom.set(task.roomId, list);
  }

  const out: RoomFreshnessVM[] = [];
  for (const room of rooms) {
    const list = tasksByRoom.get(room.id) ?? [];
    if (list.length === 0) continue; // stanza senza task attivi: nessuna barra.
    // Più sporco prima.
    list.sort((a, b) => a.freshness - b.freshness);
    const avg = list.reduce((s, t) => s + t.freshness, 0) / list.length;
    out.push({
      roomId: room.id,
      roomName: room.name,
      roomIcon: room.icon,
      freshness: avg,
      tasks: list,
    });
  }
  return out;
}
