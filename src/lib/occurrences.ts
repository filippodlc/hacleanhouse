import type { OccurrenceVM } from "@/components/occurrence-row";
import { prisma } from "@/lib/db";
import { MS_PER_DAY, dateOnlyUTC, diffDays, isoDate } from "@/lib/dates";
import { Frequency, OccurrenceStatus, Prisma, type Member, type Task } from "@prisma/client";
import "server-only";

/** Numero di giorni nel mese (UTC). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Indica se un task ricorrente è "dovuto" in una certa data, usando `startDate`
 * come ancora di ricorrenza. Ritorna anche il numero di sequenza dell'occorrenza
 * (0-based) per pilotare la rotazione in modo deterministico.
 *
 * Rispetta i limiti di fine serie: `repeatCount` (dopo N occorrenze) ed `endDate`
 * (fino a una data inclusiva). Se entrambi sono null la serie è infinita.
 */
function dueInfo(task: Task, date: Date): { due: boolean; seq: number } {
  const anchor = dateOnlyUTC(task.startDate);
  const target = dateOnlyUTC(date);
  const delta = diffDays(target, anchor);
  if (delta < 0) return { due: false, seq: 0 };

  let due = false;
  let seq = 0;
  switch (task.frequency) {
    case Frequency.DAILY:
      due = true;
      seq = delta;
      break;
    case Frequency.WEEKLY:
      due = delta % 7 === 0;
      seq = Math.floor(delta / 7);
      break;
    case Frequency.EVERY_N_DAYS: {
      const n = task.everyNDays && task.everyNDays > 0 ? task.everyNDays : 1;
      due = delta % n === 0;
      seq = Math.floor(delta / n);
      break;
    }
    case Frequency.MONTHLY: {
      const anchorDay = anchor.getUTCDate();
      const dim = daysInMonth(target.getUTCFullYear(), target.getUTCMonth());
      // Clamp per mesi corti (es. ancora il 31 -> ultimo giorno del mese).
      const effectiveDay = Math.min(anchorDay, dim);
      due = target.getUTCDate() === effectiveDay;
      seq =
        (target.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
        (target.getUTCMonth() - anchor.getUTCMonth());
      break;
    }
    default:
      return { due: false, seq: 0 };
  }

  if (!due) return { due: false, seq };
  // Limiti di fine serie.
  if (task.repeatCount != null && seq >= task.repeatCount) return { due: false, seq };
  if (task.endDate != null && target > dateOnlyUTC(task.endDate)) return { due: false, seq };
  return { due: true, seq };
}

/**
 * Costruisce la RRULE (RFC 5545, senza prefisso "RRULE:") corrispondente alla
 * ricorrenza del task, per creare un singolo evento ricorrente sul calendario HA.
 *
 * Nota: per MONTHLY con giorno > 28 la RRULE Google (FREQ=MONTHLY su BYMONTHDAY
 * implicito dal dtstart) salta i mesi corti, mentre la nostra logica interna fa
 * il clamp all'ultimo giorno: piccola divergenza accettata e documentata.
 */
export function buildRRule(task: Task): string | null {
  const parts: string[] = [];
  switch (task.frequency) {
    case Frequency.DAILY:
      parts.push("FREQ=DAILY");
      break;
    case Frequency.EVERY_N_DAYS:
      parts.push("FREQ=DAILY", `INTERVAL=${task.everyNDays && task.everyNDays > 0 ? task.everyNDays : 1}`);
      break;
    case Frequency.WEEKLY:
      parts.push("FREQ=WEEKLY");
      break;
    case Frequency.MONTHLY:
      parts.push("FREQ=MONTHLY");
      break;
    default:
      return null;
  }
  if (task.repeatCount != null && task.repeatCount > 0) {
    parts.push(`COUNT=${task.repeatCount}`);
  } else if (task.endDate != null) {
    const e = dateOnlyUTC(task.endDate);
    const until = `${e.getUTCFullYear()}${String(e.getUTCMonth() + 1).padStart(2, "0")}${String(e.getUTCDate()).padStart(2, "0")}`;
    parts.push(`UNTIL=${until}`);
  }
  return parts.join(";");
}

/** Intervallo nominale in giorni della ricorrenza (MONTHLY ≈ 30). */
export function frequencyIntervalDays(task: Task): number {
  switch (task.frequency) {
    case Frequency.DAILY:
      return 1;
    case Frequency.WEEKLY:
      return 7;
    case Frequency.EVERY_N_DAYS:
      return task.everyNDays && task.everyNDays > 0 ? task.everyNDays : 1;
    case Frequency.MONTHLY:
      return 30;
    default:
      return 1;
  }
}

/**
 * Membro assegnato a una certa sequenza. Solo la ROTATION ruota tra i membri
 * della casa; in FIXED gli assegnatari sono il set fisso del task (gestito a
 * monte) e qui non si applica.
 */
function rotationMember(members: Member[], seq: number): Member | null {
  if (members.length === 0) return null;
  return members[seq % members.length];
}

/**
 * Id del membro assegnato a uno slot di cadenza per la ROTATION (null in FIXED o
 * senza membri). Usato dalle action per il titolo degli eventi standalone.
 */
export function rotationMemberId(task: Task, members: Member[], date: Date): string | null {
  if (task.assignmentMode === "FIXED") return null;
  const m = rotationMember(members, dueInfo(task, date).seq);
  return m?.id ?? null;
}

/** Assegnatari (nome+colore) di un'occorrenza, dal task e dalla sequenza. */
function assigneesFor(
  task: Task & { assignees: Member[] },
  members: Member[],
  seq: number,
): { name: string; color: string | null }[] {
  if (task.assignmentMode === "FIXED") {
    return task.assignees.map((a) => ({ name: a.displayName, color: a.color }));
  }
  const m = rotationMember(members, seq);
  return m ? [{ name: m.displayName, color: m.color }] : [];
}

// --- ID virtuale dell'occorrenza ------------------------------------------
//
// Le occorrenze non hanno una riga DB dedicata: l'id usato dalla UI codifica lo
// slot di cadenza (identità stabile, sopravvive alla ripianificazione).

export function encodeOccId(taskId: string, cadenceDate: Date): string {
  return `${taskId}_${isoDate(cadenceDate)}`;
}

export function decodeOccId(occId: string): { taskId: string; cadenceDate: Date } | null {
  const i = occId.lastIndexOf("_");
  if (i < 0) return null;
  const taskId = occId.slice(0, i);
  const datePart = occId.slice(i + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !taskId) return null;
  return { taskId, cadenceDate: new Date(`${datePart}T00:00:00.000Z`) };
}

// --- Helper di cadenza -----------------------------------------------------

/** Quante iterazioni-giorno al massimo per trovare uno slot (sicurezza serie infinite). */
const MAX_SCAN_DAYS = 400;

/** Primo slot di cadenza con data >= `date` (o null se la serie finisce prima). */
export function firstCadenceOnOrAfter(task: Task, date: Date): Date | null {
  const anchor = dateOnlyUTC(task.startDate);
  let cur = dateOnlyUTC(date);
  if (cur.getTime() < anchor.getTime()) cur = anchor;
  for (let i = 0; i < MAX_SCAN_DAYS; i++) {
    const { due } = dueInfo(task, cur);
    if (due) return cur;
    // Se siamo oltre la fine serie e non più dovuti, fermiamoci.
    if (task.endDate != null && cur > dateOnlyUTC(task.endDate)) return null;
    cur = new Date(cur.getTime() + MS_PER_DAY);
  }
  return null;
}

/** Slot di cadenza immediatamente successivo a `date` (esclusiva). */
export function nextCadenceAfter(task: Task, date: Date): Date | null {
  return firstCadenceOnOrAfter(task, new Date(dateOnlyUTC(date).getTime() + MS_PER_DAY));
}

// --- Lista occorrenze (virtuali + override) --------------------------------

export const OVERDUE_LOOKBACK_DAYS = 30;
export const UPCOMING_LOOKAHEAD_DAYS = 14;

/**
 * Calcola le occorrenze di una casa nella finestra [from, to] unendo gli slot di
 * cadenza virtuali con le eccezioni salvate in TaskOccurrence. Una riga override
 * sostituisce lo slot di cadenza omonimo (`cadenceDate`) e viene mostrata alla sua
 * `dueDate` (≠ cadenceDate solo se ripianificata).
 */
export async function listOccurrences(opts: {
  houseId: string;
  from: Date;
  to: Date;
}): Promise<OccurrenceVM[]> {
  const from = dateOnlyUTC(opts.from);
  const to = dateOnlyUTC(opts.to);

  const [tasks, members, overrides] = await Promise.all([
    prisma.task.findMany({
      where: { houseId: opts.houseId, active: true },
      include: { room: true, assignees: true },
    }),
    prisma.member.findMany({
      where: { houseId: opts.houseId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.taskOccurrence.findMany({
      where: {
        houseId: opts.houseId,
        OR: [
          { cadenceDate: { gte: from, lte: to } },
          { dueDate: { gte: from, lte: to } },
        ],
      },
    }),
  ]);

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  // Override indicizzati per slot di cadenza (taskId_cadenceISO).
  const overrideByCadence = new Map<string, (typeof overrides)[number]>();
  for (const o of overrides) {
    overrideByCadence.set(`${o.taskId}_${isoDate(o.cadenceDate)}`, o);
  }
  const consumed = new Set<string>();

  const out: OccurrenceVM[] = [];

  const toVMRow = (
    task: Task & { assignees: Member[]; room: { name: string; icon: string } },
    cadenceDate: Date,
    seq: number,
    override: (typeof overrides)[number] | undefined,
  ): OccurrenceVM | null => {
    const displayDate = override ? dateOnlyUTC(override.dueDate) : cadenceDate;
    // Eccezione ripianificata fuori finestra: non mostrarla qui.
    if (displayDate.getTime() < from.getTime() || displayDate.getTime() > to.getTime()) return null;
    const status = override?.status ?? OccurrenceStatus.PENDING;
    const onCalendar = override
      ? !!override.haEventId || (!!task.haEventId && !override.calendarRemoved)
      : !!task.haEventId;
    return {
      id: encodeOccId(task.id, cadenceDate),
      taskName: task.name,
      roomName: task.room.name,
      roomIcon: task.room.icon,
      priority: task.priority,
      estMinutes: task.estMinutes,
      status,
      assignees: assigneesFor(task, members, seq),
      dueDate: isoDate(displayDate),
      onCalendar,
    };
  };

  // 1. Enumera gli slot di cadenza nella finestra.
  for (const task of tasks) {
    const cur = from.getTime() < dateOnlyUTC(task.startDate).getTime()
      ? dateOnlyUTC(task.startDate)
      : from;
    for (let t = cur.getTime(); t <= to.getTime(); t += MS_PER_DAY) {
      const date = dateOnlyUTC(new Date(t));
      const { due, seq } = dueInfo(task, date);
      if (!due) continue;
      const key = `${task.id}_${isoDate(date)}`;
      const override = overrideByCadence.get(key);
      if (override) consumed.add(key);
      const vm = toVMRow(task, date, seq, override);
      if (vm) out.push(vm);
    }
  }

  // 2. Override ripianificate DENTRO la finestra ma il cui slot di cadenza è
  //    fuori finestra (non enumerato sopra): rendile alla loro dueDate.
  for (const o of overrides) {
    const key = `${o.taskId}_${isoDate(o.cadenceDate)}`;
    if (consumed.has(key)) continue;
    const task = taskById.get(o.taskId);
    if (!task) continue;
    const { seq } = dueInfo(task, o.cadenceDate);
    const vm = toVMRow(task, dateOnlyUTC(o.cadenceDate), seq, o);
    if (vm) out.push(vm);
  }

  // Ordine stabile: per data, poi priorità.
  out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.priority - b.priority));
  return out;
}

// --- Contesto occorrenza --------------------------------------------------

export type TaskFull = Prisma.TaskGetPayload<{ include: { room: true; assignees: true } }>;
export type OccRow = Prisma.TaskOccurrenceGetPayload<object>;

/**
 * Contesto di una singola occorrenza (virtuale o con override). Identità = lo slot
 * di cadenza (`cadenceDate`). `dueDate` è la data mostrata (= cadenceDate, tranne se
 * ripianificata). `row` è l'eventuale eccezione salvata in DB.
 */
export type OccCtx = {
  task: TaskFull;
  cadenceDate: Date;
  dueDate: Date;
  haEventId: string | null;
  calendarRemoved: boolean;
  assignedMember: Member | null;
  row: OccRow | null;
};

/** Campi di deviazione applicabili a un'eccezione. */
export type OccPatch = {
  status?: OccurrenceStatus;
  dueDate?: Date;
  completedAt?: Date | null;
  completedByMemberId?: string | null;
  haEventId?: string | null;
  calendarRemoved?: boolean;
};

/** Carica il contesto di un'occorrenza dall'id virtuale (taskId_YYYY-MM-DD). */
export async function loadOcc(occId: string, houseId: string): Promise<OccCtx | null> {
  const dec = decodeOccId(occId);
  if (!dec) return null;
  const task = await prisma.task.findFirst({
    where: { id: dec.taskId, houseId },
    include: { room: true, assignees: true },
  });
  if (!task) return null;
  const [row, members] = await Promise.all([
    prisma.taskOccurrence.findUnique({
      where: { taskId_cadenceDate: { taskId: task.id, cadenceDate: dec.cadenceDate } },
    }),
    prisma.member.findMany({ where: { houseId }, orderBy: { createdAt: "asc" } }),
  ]);
  const assignedId = rotationMemberId(task, members, dec.cadenceDate);
  return {
    task,
    cadenceDate: dec.cadenceDate,
    dueDate: row ? dateOnlyUTC(row.dueDate) : dec.cadenceDate,
    haEventId: row?.haEventId ?? null,
    calendarRemoved: row?.calendarRemoved ?? false,
    assignedMember: assignedId ? members.find((m) => m.id === assignedId) ?? null : null,
    row,
  };
}

/** Upsert dell'eccezione per uno slot di cadenza. Ritorna la riga salvata. */
export function upsertOcc(ctx: OccCtx, patch: OccPatch): Promise<OccRow> {
  return prisma.taskOccurrence.upsert({
    where: { taskId_cadenceDate: { taskId: ctx.task.id, cadenceDate: ctx.cadenceDate } },
    create: {
      houseId: ctx.task.houseId,
      taskId: ctx.task.id,
      cadenceDate: ctx.cadenceDate,
      dueDate: patch.dueDate ?? ctx.dueDate,
      status: patch.status ?? OccurrenceStatus.PENDING,
      completedAt: patch.completedAt ?? null,
      completedByMemberId: patch.completedByMemberId ?? null,
      haEventId: patch.haEventId ?? null,
      calendarRemoved: patch.calendarRemoved ?? false,
    },
    update: patch,
  });
}
