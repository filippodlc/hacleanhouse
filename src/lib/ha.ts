import "server-only";
import { env, haWebsocketUrl } from "@/lib/env";

export type HaUser = { haUserId: string; name: string };

/**
 * Valida un access token di Home Assistant aprendo una connessione WebSocket
 * e chiedendo l'utente corrente. È l'unico modo *certo* di legare il token a un
 * utente HA (il frontend ufficiale usa lo stesso comando `auth/current_user`).
 *
 * Ritorna l'utente se il token è valido, altrimenti `null`.
 */
export function validateHaToken(token: string): Promise<HaUser | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: HaUser | null) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* noop */
      }
      clearTimeout(timer);
      resolve(value);
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(haWebsocketUrl());
    } catch {
      resolve(null);
      return;
    }

    const timer = setTimeout(() => finish(null), 8000);

    ws.addEventListener("message", (event) => {
      let msg: { type?: string; success?: boolean; result?: { id?: string; name?: string } };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (msg.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: token }));
      } else if (msg.type === "auth_ok") {
        ws.send(JSON.stringify({ id: 1, type: "auth/current_user" }));
      } else if (msg.type === "auth_invalid") {
        finish(null);
      } else if (msg.type === "result") {
        if (msg.success && msg.result?.id) {
          finish({ haUserId: msg.result.id, name: msg.result.name ?? "Utente HA" });
        } else {
          finish(null);
        }
      }
    });

    ws.addEventListener("error", () => finish(null));
    ws.addEventListener("close", () => finish(null));
  });
}

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// --- Calendario HA --------------------------------------------------------
//
// Modello: una serie = UN evento ricorrente (RRULE) sul calendario. La create
// avviene via WebSocket (`calendar/event/create`, accetta `rrule`), ma HA NON
// restituisce lo uid alla create e nemmeno via `calendar/event/list` (la list WS
// non include uid/recurrence_id). Lo uid e i recurrence_id delle istanze si
// recuperano invece dall'endpoint REST `/api/calendars/<entity>`, che serializza
// l'evento completo. Il delete (WebSocket) supporta `recurrence_id` +
// `recurrence_range` (NONE | THISANDFUTURE).

type WsCommand = Record<string, unknown> & { type: string };

/**
 * Esegue un singolo comando WebSocket autenticato su HA e indica se è andato a
 * buon fine. Riusa lo stesso handshake di `validateHaToken`.
 */
function haWsCommand(token: string, command: WsCommand): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* noop */
      }
      clearTimeout(timer);
      resolve(value);
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(haWebsocketUrl());
    } catch {
      resolve(false);
      return;
    }

    const timer = setTimeout(() => finish(false), 10000);

    ws.addEventListener("message", (event) => {
      let msg: { type?: string; id?: number; success?: boolean };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (msg.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: token }));
      } else if (msg.type === "auth_ok") {
        ws.send(JSON.stringify({ id: 1, ...command }));
      } else if (msg.type === "auth_invalid") {
        finish(false);
      } else if (msg.type === "result" && msg.id === 1) {
        finish(!!msg.success);
      }
    });

    ws.addEventListener("error", () => finish(false));
    ws.addEventListener("close", () => finish(false));
  });
}

export type HaCalEvent = {
  uid: string | null;
  recurrenceId: string | null;
  date: string; // YYYY-MM-DD (data di inizio dell'istanza)
  summary: string | null;
};

/**
 * Elenca gli eventi del calendario HA in un intervallo via REST. A differenza
 * della list WebSocket, l'endpoint REST include `uid` e `recurrence_id`.
 */
export async function listCalendarEventsRest(opts: {
  token: string;
  start: string; // YYYY-MM-DD (inclusivo)
  end: string; // YYYY-MM-DD (esclusivo)
}): Promise<HaCalEvent[]> {
  if (!env.haCalendarEntity) return [];
  const url =
    `${env.haBaseUrl}/api/calendars/${env.haCalendarEntity}` +
    `?start=${encodeURIComponent(`${opts.start}T00:00:00`)}` +
    `&end=${encodeURIComponent(`${opts.end}T00:00:00`)}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${opts.token}` } });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<Record<string, unknown>>;
    return data.map((e) => {
      const start = e.start as { date?: string; dateTime?: string } | undefined;
      const date = start?.date ?? (start?.dateTime ? start.dateTime.slice(0, 10) : "");
      return {
        uid: typeof e.uid === "string" ? e.uid : null,
        recurrenceId: typeof e.recurrence_id === "string" ? e.recurrence_id : null,
        date,
        summary: typeof e.summary === "string" ? e.summary : null,
      };
    });
  } catch {
    return [];
  }
}

/** Recupera lo uid (iCal) di un evento creato, cercandolo per summary + data. */
export async function resolveEventUid(opts: {
  token: string;
  summary: string;
  date: string;
}): Promise<string | null> {
  const events = await listCalendarEventsRest({
    token: opts.token,
    start: opts.date,
    end: addOneDay(opts.date),
  });
  const match = events.find((e) => e.summary === opts.summary && e.date === opts.date && e.uid);
  return match?.uid ?? null;
}

/** Recupera il recurrence_id dell'istanza di una serie in una certa data. */
export async function resolveRecurrenceId(opts: {
  token: string;
  uid: string;
  date: string;
}): Promise<string | null> {
  const events = await listCalendarEventsRest({
    token: opts.token,
    start: opts.date,
    end: addOneDay(opts.date),
  });
  const match = events.find((e) => e.uid === opts.uid && e.date === opts.date && e.recurrenceId);
  return match?.recurrenceId ?? null;
}

/**
 * Crea un evento giornata intera sul calendario HA (via WebSocket). Se `rrule` è
 * presente l'evento è ricorrente. Ritorna solo l'esito: lo uid va recuperato a
 * parte con `resolveEventUid` (HA non lo restituisce alla create).
 */
export async function createCalendarEventWs(opts: {
  token: string;
  summary: string;
  description?: string;
  date: string; // YYYY-MM-DD
  rrule?: string | null;
}): Promise<boolean> {
  if (!env.haCalendarEntity) return false;
  const event: Record<string, unknown> = {
    summary: opts.summary,
    description: opts.description ?? "",
    dtstart: opts.date,
    dtend: addOneDay(opts.date), // all-day: end esclusivo
  };
  if (opts.rrule) event.rrule = opts.rrule;

  return haWsCommand(opts.token, {
    type: "calendar/event/create",
    entity_id: env.haCalendarEntity,
    event,
  });
}

/**
 * Cancella un evento dal calendario HA via WebSocket.
 * - serie intera: solo `uid`;
 * - singola istanza: `uid` + `recurrenceId` (range NONE);
 * - "questa e successive": `uid` + `recurrenceId` + range THISANDFUTURE.
 */
export async function deleteCalendarEventWs(opts: {
  token: string;
  uid: string;
  recurrenceId?: string | null;
  recurrenceRange?: "THISANDFUTURE";
}): Promise<boolean> {
  if (!env.haCalendarEntity) return false;
  const command: WsCommand = {
    type: "calendar/event/delete",
    entity_id: env.haCalendarEntity,
    uid: opts.uid,
  };
  if (opts.recurrenceId) command.recurrence_id = opts.recurrenceId;
  if (opts.recurrenceRange) command.recurrence_range = opts.recurrenceRange;
  return haWsCommand(opts.token, command);
}
