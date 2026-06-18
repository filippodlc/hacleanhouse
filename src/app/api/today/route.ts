import { ensureDefaultHouse } from "@/lib/auth";
import { env } from "@/lib/env";
import { listOccurrences, OVERDUE_LOOKBACK_DAYS } from "@/lib/occurrences";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

const MS_PER_DAY = 86_400_000;

/**
 * Verifica del token in tempo costante (no short-circuit al primo byte ->
 * niente timing leak sul token). timingSafeEqual richiede buffer di pari
 * lunghezza, quindi il check di lunghezza fa da guardia; la differenza di
 * lunghezza non è segreta (la lunghezza del token atteso è fissa).
 *
 * Lo schema `Bearer ` è opzionale: il secret in HA contiene solo il token
 * grezzo (YAML non permette di concatenare una stringa letterale con `!secret`,
 * quindi l'header arriva senza prefisso), ma accettiamo anche `Bearer <token>`
 * per chi preferisce inviarlo nello schema HTTP standard.
 */
function authOk(header: string | null): boolean {
  if (!header) return false;
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;
  const expected = Buffer.from(env.apiToken);
  const got = Buffer.from(token);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** "GG/MM" da una data ISO "YYYY-MM-DD". */
function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Riga "• Stanza — Task (Assegnatari)", con scadenza opzionale per le arretrate. */
function line(o: { roomName: string; taskName: string; assignees: { name: string }[] }, due?: string): string {
  const who = o.assignees.map((a) => a.name).join(", ");
  const date = due ? ` — scad. ${ddmm(due)}` : "";
  return `• ${o.roomName} — ${o.taskName}${who ? ` (${who})` : ""}${date}`;
}

// Dipende dalla data corrente e dal DB: mai cachare.
export const dynamic = "force-dynamic";

/**
 * Endpoint server-to-server per la notifica mattutina di Home Assistant.
 *
 * Ritorna le pulizie PENDING in scadenza OGGI (fuso Europe/Rome) della casa di
 * default, già formattate come testo pronto da inoltrare a `notify.casa`.
 *
 * Auth: header `Authorization: Bearer <HACLEANHOUSE_API_TOKEN>`. Questo flusso
 * non ha cookie di sessione (HA chiama il server direttamente), quindi si usa un
 * token condiviso. Se il token non è configurato l'endpoint è disabilitato.
 */
export async function GET(request: Request) {
  if (!env.apiToken) {
    return NextResponse.json({ error: "API disabilitata" }, { status: 503 });
  }
  if (!authOk(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  // "Oggi" nel fuso di casa (il container gira con TZ=Europe/Rome, ma fissiamo
  // il fuso esplicitamente per non dipendere dall'ambiente). listOccurrences
  // ragiona su date "solo giorno" in UTC: costruiamo la mezzanotte UTC del
  // giorno civile romano.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const today = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  const dateIso = today.toISOString().slice(0, 10);

  const house = await ensureDefaultHouse();

  // Finestra: ultimi OVERDUE_LOOKBACK_DAYS giorni .. oggi, così la stessa query
  // copre sia le pulizie di oggi sia le arretrate non fatte.
  const from = new Date(today.getTime() - OVERDUE_LOOKBACK_DAYS * MS_PER_DAY);
  const occ = (await listOccurrences({ houseId: house.id, from, to: today })).filter(
    (o) => o.status === "PENDING",
  );

  // Solo PENDING: le arretrate sono quelle con scadenza prima di oggi (mancate),
  // le odierne quelle che scadono oggi. Le SKIPPED esplicite restano escluse.
  const todayOcc = occ.filter((o) => o.dueDate === dateIso);
  const overdue = occ
    .filter((o) => o.dueDate < dateIso)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  const sections: string[] = [];
  if (todayOcc.length > 0) {
    sections.push(
      `🤟🏻 Cosa devi fare oggi (${todayOcc.length}):\n${todayOcc.map((o) => line(o)).join("\n")}`,
    );
  }
  if (overdue.length > 0) {
    sections.push(
      `⚠️ Arretrate (${overdue.length}):\n${overdue.map((o) => line(o, o.dueDate)).join("\n")}`,
    );
  }

  const message =
    sections.length > 0 ? sections.join("\n\n") : "🧹 Nessuna pulizia in programma oggi.";

  return NextResponse.json({
    date: dateIso,
    count: todayOcc.length + overdue.length,
    today: todayOcc.length,
    overdue: overdue.length,
    message,
  });
}
