"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Frequency, AssignmentMode, OccurrenceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import { requireMember, requireAdmin, getHaAccessToken } from "@/lib/auth";
import {
  createCalendarEventWs,
  deleteCalendarEventWs,
  resolveEventUid,
  resolveRecurrenceId,
} from "@/lib/ha";
import {
  buildRRule,
  firstCadenceOnOrAfter,
  loadOcc,
  nextCadenceAfter,
  upsertOcc,
  type OccCtx,
} from "@/lib/occurrences";
import { DATE_RE, MS_PER_DAY, dateOnlyUTC, parseDateUTC } from "@/lib/dates";
import {
  DESCRIPTION,
  SUMMARY,
  occurrenceAssigneeNames,
  seriesAssigneeNames,
} from "@/lib/calendar";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/manage");
}

// --- Stanze ---------------------------------------------------------------

const roomSchema = z.object({
  name: z.string().trim().min(1, "Nome obbligatorio"),
  icon: z.string().trim().min(1).default("mdi:broom"),
  order: z.coerce.number().int().default(0),
});

export async function createRoom(input: z.input<typeof roomSchema>) {
  const member = await requireMember();
  const data = roomSchema.parse(input);
  await prisma.room.create({ data: { ...data, houseId: member.houseId } });
  revalidateAll();
}

export async function updateRoom(id: string, input: z.input<typeof roomSchema>) {
  const member = await requireMember();
  const data = roomSchema.parse(input);
  await prisma.room.updateMany({ where: { id, houseId: member.houseId }, data });
  revalidateAll();
}

export async function deleteRoom(id: string) {
  const member = await requireMember();
  await prisma.room.deleteMany({ where: { id, houseId: member.houseId } });
  revalidateAll();
}

// --- Membri ---------------------------------------------------------------

const memberSchema = z.object({
  haUserId: z.string().trim().min(1, "haUserId obbligatorio"),
  displayName: z.string().trim().min(1, "Nome obbligatorio"),
  haPersonEntityId: z.string().trim().optional().or(z.literal("")),
  color: z.string().trim().default("#3b82f6"),
});

export async function createMember(input: z.input<typeof memberSchema>) {
  const member = await requireAdmin();
  const data = memberSchema.parse(input);
  await prisma.member.create({
    data: {
      houseId: member.houseId,
      haUserId: data.haUserId,
      displayName: data.displayName,
      haPersonEntityId: data.haPersonEntityId || null,
      color: data.color,
    },
  });
  revalidateAll();
}

export async function updateMember(id: string, input: z.input<typeof memberSchema>) {
  const member = await requireAdmin();
  const data = memberSchema.parse(input);
  await prisma.member.updateMany({
    where: { id, houseId: member.houseId },
    data: {
      displayName: data.displayName,
      haPersonEntityId: data.haPersonEntityId || null,
      color: data.color,
    },
  });
  revalidateAll();
}

export async function deleteMember(id: string) {
  const member = await requireAdmin();
  if (id === member.id) throw new Error("Non puoi eliminare te stesso");
  await prisma.member.deleteMany({ where: { id, houseId: member.houseId } });
  revalidateAll();
}

// --- Task -----------------------------------------------------------------

const taskSchema = z
  .object({
    roomId: z.string().min(1, "Stanza obbligatoria"),
    name: z.string().trim().min(1, "Nome obbligatorio"),
    frequency: z.nativeEnum(Frequency),
    everyNDays: z.coerce.number().int().min(1).optional(),
    startDate: z.string().regex(DATE_RE, "Data di inizio non valida"),
    // Fine ricorrenza: "dopo N volte" (COUNT), "fino a data" (DATE) o mai (NEVER).
    endMode: z.enum(["COUNT", "DATE", "NEVER"]),
    repeatCount: z.coerce.number().int().min(1).optional(),
    endDate: z.string().regex(DATE_RE).optional().or(z.literal("")),
    assignmentMode: z.nativeEnum(AssignmentMode).default(AssignmentMode.ROTATION),
    // FIXED: uno o più assegnatari fissi. ROTATION: ignorato (ruota tra i membri).
    assignedMemberIds: z.array(z.string()).default([]),
    active: z.coerce.boolean().default(true),
  })
  .refine((d) => (d.endMode === "COUNT" ? !!d.repeatCount : true), {
    message: "Numero di ripetizioni obbligatorio",
    path: ["repeatCount"],
  })
  .refine((d) => (d.endMode === "DATE" ? !!d.endDate && d.endDate >= d.startDate : true), {
    message: "Data di fine obbligatoria e non precedente all'inizio",
    path: ["endDate"],
  })
  .refine((d) => d.assignmentMode !== AssignmentMode.FIXED || d.assignedMemberIds.length > 0, {
    message: "Seleziona almeno un membro",
    path: ["assignedMemberIds"],
  });

type TaskData = z.output<typeof taskSchema>;

/** Campi del task derivati dall'input del form (proprietà condivise da create/update). */
function taskProps(data: TaskData) {
  return {
    roomId: data.roomId,
    name: data.name,
    frequency: data.frequency,
    everyNDays: data.frequency === Frequency.EVERY_N_DAYS ? data.everyNDays ?? 1 : null,
    assignmentMode: data.assignmentMode,
    active: data.active,
  };
}

/** Limiti di fine serie a partire dall'endMode. NEVER → serie infinita (entrambi null). */
function endBounds(data: TaskData) {
  if (data.endMode === "NEVER") return { repeatCount: null, endDate: null };
  return {
    repeatCount: data.endMode === "COUNT" ? data.repeatCount ?? null : null,
    endDate: data.endMode === "DATE" && data.endDate ? parseDateUTC(data.endDate) : null,
  };
}

/**
 * Filtra gli id assegnatari validi (esistenti e della stessa casa) da usare per
 * la relazione `assignees`. Solo per la modalità FIXED; in ROTATION è vuoto.
 */
async function validAssigneeIds(data: TaskData, houseId: string): Promise<string[]> {
  if (data.assignmentMode !== AssignmentMode.FIXED || data.assignedMemberIds.length === 0) {
    return [];
  }
  const members = await prisma.member.findMany({
    where: { id: { in: data.assignedMemberIds }, houseId },
    select: { id: true },
  });
  return members.map((m) => m.id);
}

/**
 * Crea sul calendario HA un singolo evento ricorrente per la serie e salva lo
 * uid su Task.haEventId. No-op senza token o se già sincronizzata.
 */
async function pushSeriesToCalendar(token: string | null, taskId: string) {
  if (!token) return;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { room: true, assignees: true },
  });
  if (!task || task.haEventId) return;

  // dtstart = primo slot di cadenza da oggi in poi (on-cadence, mai nel passato già
  // coperto dal vecchio troncone), non l'ancora `startDate` che può essere passata.
  const firstCad = firstCadenceOnOrAfter(task, dateOnlyUTC(new Date())) ?? dateOnlyUTC(task.startDate);
  const date = firstCad.toISOString().slice(0, 10);
  const summary = SUMMARY(task.name, await seriesAssigneeNames(task));
  const ok = await createCalendarEventWs({
    token,
    summary,
    description: DESCRIPTION(task.room.name),
    date,
    rrule: buildRRule(task),
  });
  if (!ok) return;
  const uid = await resolveEventUid({ token, summary, date });
  if (uid) await prisma.task.update({ where: { id: taskId }, data: { haEventId: uid } });
}

/**
 * Cancella la serie dal calendario: l'intero evento (fromDate assente) oppure
 * solo "questa e successive" a partire da fromDate (THISANDFUTURE).
 */
async function deleteSeriesFromCalendar(
  token: string | null,
  task: { haEventId: string | null },
  fromDate?: Date,
) {
  if (!token || !task.haEventId) return;
  if (!fromDate) {
    await deleteCalendarEventWs({ token, uid: task.haEventId });
    return;
  }
  const date = fromDate.toISOString().slice(0, 10);
  const recurrenceId = await resolveRecurrenceId({ token, uid: task.haEventId, date });
  if (recurrenceId) {
    await deleteCalendarEventWs({
      token,
      uid: task.haEventId,
      recurrenceId,
      recurrenceRange: "THISANDFUTURE",
    });
  } else {
    // Istanza non trovata: ripieghiamo cancellando l'intera serie.
    await deleteCalendarEventWs({ token, uid: task.haEventId });
  }
}

/** Rimuove dal calendario la singola occorrenza (evento standalone o istanza della serie). */
async function removeOccurrenceInstance(token: string | null, occ: OccCtx): Promise<boolean> {
  if (!token) return false;
  if (occ.haEventId) {
    return deleteCalendarEventWs({ token, uid: occ.haEventId });
  }
  if (occ.task.haEventId && !occ.calendarRemoved) {
    const date = occ.dueDate.toISOString().slice(0, 10);
    const recurrenceId = await resolveRecurrenceId({ token, uid: occ.task.haEventId, date });
    if (recurrenceId) {
      return deleteCalendarEventWs({ token, uid: occ.task.haEventId, recurrenceId });
    }
  }
  return false;
}

/**
 * Ri-aggiunge la singola occorrenza come evento standalone (non si può
 * "annullare" l'eccezione su una serie). Ritorna lo uid creato o null.
 */
async function addOccurrenceStandalone(token: string | null, occ: OccCtx): Promise<string | null> {
  if (!token) return null;
  const date = occ.dueDate.toISOString().slice(0, 10);
  const summary = SUMMARY(occ.task.name, occurrenceAssigneeNames(occ));
  const ok = await createCalendarEventWs({
    token,
    summary,
    description: DESCRIPTION(occ.task.room.name),
    date,
  });
  if (!ok) return null;
  return resolveEventUid({ token, summary, date });
}

export async function createTask(input: z.input<typeof taskSchema>) {
  const member = await requireMember();
  const data = taskSchema.parse(input);
  // La stanza deve appartenere alla casa del membro.
  const room = await prisma.room.findFirst({
    where: { id: data.roomId, houseId: member.houseId },
  });
  if (!room) throw new Error("Stanza non valida");

  const assigneeIds = await validAssigneeIds(data, member.houseId);
  const task = await prisma.task.create({
    data: {
      houseId: member.houseId,
      ...taskProps(data),
      startDate: parseDateUTC(data.startDate),
      ...endBounds(data),
      seriesId: randomUUID(),
      assignees: { connect: assigneeIds.map((id) => ({ id })) },
    },
  });
  // Occorrenze virtuali (calcolate al volo): basta creare l'evento ricorrente sul calendario.
  await pushSeriesToCalendar(await getHaAccessToken(), task.id);
  revalidateAll();
}

/**
 * Modifica una ricorrenza con semantica Google Calendar "questa e successive":
 * il passato resta invariato; dalla prima occorrenza futura disponibile in poi
 * valgono le nuove proprietà (nuovo Task, stessa serie). Sul calendario la coda
 * della vecchia serie viene troncata (THISANDFUTURE) e si crea la nuova serie.
 */
export async function updateTask(id: string, input: z.input<typeof taskSchema>) {
  const member = await requireMember();
  const data = taskSchema.parse(input);

  const existing = await prisma.task.findFirst({ where: { id, houseId: member.houseId } });
  if (!existing) throw new Error("Task non valido");
  const room = await prisma.room.findFirst({
    where: { id: data.roomId, houseId: member.houseId },
  });
  if (!room) throw new Error("Stanza non valida");

  const token = await getHaAccessToken();
  const today = dateOnlyUTC(new Date());

  // 1. Primo slot di cadenza futuro = punto di split (le occorrenze sono virtuali).
  const splitCadence = firstCadenceOnOrAfter(existing, today);
  const splitDate = splitCadence ? dateOnlyUTC(splitCadence) : today;

  // Esiste passato sse c'è uno slot di cadenza prima dello split.
  const firstEver = firstCadenceOnOrAfter(existing, dateOnlyUTC(existing.startDate));
  const hasPast = !!firstEver && dateOnlyUTC(firstEver).getTime() < splitDate.getTime();

  // 2. Rimuove le eccezioni future del vecchio task (reschedule/push futuri).
  await prisma.taskOccurrence.deleteMany({ where: { taskId: id, cadenceDate: { gte: splitDate } } });

  // 3. Tronca (o elimina) il vecchio task + relativo evento sul calendario.
  if (!hasPast) {
    await deleteSeriesFromCalendar(token, existing); // intera serie
    await prisma.task.delete({ where: { id } });
  } else {
    await deleteSeriesFromCalendar(token, existing, splitDate); // solo la coda
    await prisma.task.update({
      where: { id },
      data: { endDate: new Date(splitDate.getTime() - MS_PER_DAY), repeatCount: null },
    });
  }

  // 4. Nuovo task con le proprietà nuove. L'ancora di cadenza è la `startDate`
  //    scelta dall'utente (può essere modificata), ma le occorrenze vengono
  //    materializzate solo da splitDate in poi: il passato resta sul vecchio
  //    troncone e non viene duplicato.
  const bounds = endBounds(data);
  const assigneeIds = await validAssigneeIds(data, member.houseId);
  const newTask = await prisma.task.create({
    data: {
      houseId: member.houseId,
      ...taskProps(data),
      startDate: parseDateUTC(data.startDate),
      // Con fine "in data" precedente allo split la serie sarebbe vuota: clamp.
      repeatCount: bounds.repeatCount,
      endDate: bounds.endDate && bounds.endDate < splitDate ? splitDate : bounds.endDate,
      seriesId: existing.seriesId ?? randomUUID(),
      assignees: { connect: assigneeIds.map((id) => ({ id })) },
    },
  });
  await pushSeriesToCalendar(token, newTask.id);

  revalidateAll();
}

export async function deleteTask(id: string) {
  const member = await requireMember();
  const task = await prisma.task.findFirst({ where: { id, houseId: member.houseId } });
  if (!task) return;

  // Pulizia best-effort sul calendario: serie + eventuali eventi standalone.
  const token = await getHaAccessToken();
  await deleteSeriesFromCalendar(token, task);
  if (token) {
    const standalone = await prisma.taskOccurrence.findMany({
      where: { taskId: id, haEventId: { not: null } },
      select: { haEventId: true },
    });
    for (const o of standalone) {
      if (o.haEventId) await deleteCalendarEventWs({ token, uid: o.haEventId });
    }
  }

  await prisma.task.deleteMany({ where: { id, houseId: member.houseId } });
  revalidateAll();
}

// --- Occorrenze -----------------------------------------------------------

export async function completeOccurrence(id: string) {
  const member = await requireMember();
  const ctx = await loadOcc(id, member.houseId);
  if (!ctx) throw new Error("Occorrenza non trovata");

  await upsertOcc(ctx, {
    status: OccurrenceStatus.DONE,
    completedAt: new Date(),
    completedByMemberId: member.id,
  });
  revalidateAll();
}

export async function reopenOccurrence(id: string) {
  const member = await requireMember();
  const ctx = await loadOcc(id, member.houseId);
  if (!ctx) throw new Error("Occorrenza non trovata");

  // Nessuna eccezione salvata → era già al default (PENDING virtuale): nulla da fare.
  if (!ctx.row) {
    revalidateAll();
    return;
  }

  // Se l'eccezione non porta stato calendario né ripianificazione, la riga può
  // sparire e tornare default virtuale.
  const inPlace = dateOnlyUTC(ctx.row.dueDate).getTime() === ctx.cadenceDate.getTime();
  if (!ctx.row.haEventId && !ctx.row.calendarRemoved && inPlace) {
    await prisma.taskOccurrence.delete({ where: { id: ctx.row.id } });
    revalidateAll();
    return;
  }

  await prisma.taskOccurrence.update({
    where: { id: ctx.row.id },
    data: { status: OccurrenceStatus.PENDING, completedAt: null, completedByMemberId: null },
  });

  // Se era stata rimossa dal calendario (es. perché saltata), la ri-aggiunge
  // come evento standalone (best-effort).
  if (ctx.row.calendarRemoved) {
    const uid = await addOccurrenceStandalone(await getHaAccessToken(), ctx);
    if (uid) {
      await prisma.taskOccurrence.update({
        where: { id: ctx.row.id },
        data: { calendarRemoved: false, haEventId: uid },
      });
    }
  }
  revalidateAll();
}

export async function skipOccurrence(id: string) {
  const member = await requireMember();
  const ctx = await loadOcc(id, member.houseId);
  if (!ctx) return;

  const row = await upsertOcc(ctx, { status: OccurrenceStatus.SKIPPED });
  // Rimuove dal calendario l'istanza saltata (best-effort).
  if (await removeOccurrenceInstance(await getHaAccessToken(), ctx)) {
    await prisma.taskOccurrence.update({
      where: { id: row.id },
      data: { calendarRemoved: true, haEventId: null },
    });
  }
  revalidateAll();
}

/**
 * Intervallo valido per ripianificare un'occorrenza: dal giorno dopo la sua
 * scadenza fino al giorno prima dell'occorrenza successiva (se esiste). Se
 * `max < min` (es. cadenza giornaliera) la ripianificazione non è possibile.
 */
export async function getRescheduleBounds(id: string): Promise<{ min: string | null; max: string | null }> {
  const member = await requireMember();
  const ctx = await loadOcc(id, member.houseId);
  if (!ctx) return { min: null, max: null };
  const next = nextCadenceAfter(ctx.task, ctx.cadenceDate);
  const min = new Date(ctx.cadenceDate.getTime() + MS_PER_DAY).toISOString().slice(0, 10);
  const max = next ? new Date(dateOnlyUTC(next).getTime() - MS_PER_DAY).toISOString().slice(0, 10) : null;
  return { min, max };
}

/**
 * Sposta un'occorrenza a una nuova data. Vincoli: la nuova data dev'essere
 * successiva a quella attuale e precedente all'occorrenza successiva (non lo
 * stesso giorno, non dal giorno della prossima in poi). Sul calendario stacca
 * l'istanza corrente e ricrea un evento standalone alla nuova data.
 */
export async function rescheduleOccurrence(id: string, newDate: string) {
  const member = await requireMember();
  if (!DATE_RE.test(newDate)) return { ok: false, error: "Data non valida" };
  const ctx = await loadOcc(id, member.houseId);
  if (!ctx) return { ok: false, error: "Occorrenza non trovata" };

  const target = parseDateUTC(newDate);
  // I vincoli sono relativi allo SLOT di cadenza (identità), non alla data mostrata.
  if (target.getTime() <= ctx.cadenceDate.getTime()) {
    return { ok: false, error: "La nuova data dev'essere successiva a quella attuale" };
  }
  const next = nextCadenceAfter(ctx.task, ctx.cadenceDate);
  if (next && target.getTime() >= dateOnlyUTC(next).getTime()) {
    return { ok: false, error: "Non puoi ripianificare il giorno dell'occorrenza successiva o dopo" };
  }

  const token = await getHaAccessToken();
  // Stacca l'istanza corrente dal calendario (best-effort).
  await removeOccurrenceInstance(token, ctx);
  // Override con cadenceDate invariato (slot originale soppresso in lista) e dueDate spostata.
  const row = await upsertOcc(ctx, {
    dueDate: target,
    status: OccurrenceStatus.PENDING,
    calendarRemoved: false,
    haEventId: null,
    completedAt: null,
    completedByMemberId: null,
  });

  // Ricrea l'occorrenza come evento standalone alla nuova data.
  const uid = await addOccurrenceStandalone(token, { ...ctx, dueDate: target, haEventId: null });
  if (uid) await prisma.taskOccurrence.update({ where: { id: row.id }, data: { haEventId: uid } });
  revalidateAll();
  return { ok: true };
}

/** Aggiunge la singola occorrenza al calendario (evento standalone). */
export async function pushOccurrenceToCalendar(id: string) {
  const member = await requireMember();
  const ctx = await loadOcc(id, member.houseId);
  if (!ctx) return { ok: false, error: "Occorrenza non trovata" };
  // Già sul calendario (coperta dalla serie o evento standalone): nulla da fare.
  if (ctx.haEventId || (ctx.task.haEventId && !ctx.calendarRemoved)) return { ok: true };

  const token = await getHaAccessToken();
  if (!token) {
    return { ok: false, error: "Token HA non disponibile (apri l'app dal pannello di HA)" };
  }
  const uid = await addOccurrenceStandalone(token, ctx);
  if (!uid) return { ok: false, error: "HA ha rifiutato la creazione evento" };
  await upsertOcc(ctx, { haEventId: uid, calendarRemoved: false });
  revalidateAll();
  return { ok: true };
}

/** Rimuove dal calendario la singola occorrenza (istanza della serie o standalone). */
export async function removeOccurrenceFromCalendar(id: string) {
  const member = await requireMember();
  const ctx = await loadOcc(id, member.houseId);
  if (!ctx) return { ok: false, error: "Occorrenza non trovata" };
  // Niente da rimuovere se non è su calendario.
  if (!ctx.haEventId && (!ctx.task.haEventId || ctx.calendarRemoved)) return { ok: true };

  const token = await getHaAccessToken();
  if (!token) {
    return { ok: false, error: "Token HA non disponibile (apri l'app dal pannello di HA)" };
  }
  const ok = await removeOccurrenceInstance(token, ctx);
  if (!ok) return { ok: false, error: "HA ha rifiutato la cancellazione evento" };
  await upsertOcc(ctx, { calendarRemoved: true, haEventId: null });
  revalidateAll();
  return { ok: true };
}
