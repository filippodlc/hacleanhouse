import { OccurrenceRow, type OccurrenceVM } from "@/components/occurrence-row";
import { RoomIcon } from "@/components/room-icon";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/auth";
import {
    listOccurrences,
    OVERDUE_LOOKBACK_DAYS,
    UPCOMING_LOOKAHEAD_DAYS,
} from "@/lib/occurrences";

export const dynamic = "force-dynamic";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Somma dei minuti stimati per persona coinvolta. Un task FIXED con più
 * assegnatari conta i suoi minuti per ognuno (tutti devono svolgerlo). Le
 * occorrenze senza assegnatario finiscono sotto "Non assegnato".
 */
function minutesByPerson(
  occ: OccurrenceVM[],
): { name: string; color: string | null; minutes: number }[] {
  const acc = new Map<string, { color: string | null; minutes: number }>();
  for (const o of occ) {
    const people = o.assignees.length > 0 ? o.assignees : [{ name: "Non assegnato", color: null }];
    for (const p of people) {
      const cur = acc.get(p.name) ?? { color: p.color, minutes: 0 };
      cur.minutes += o.estMinutes;
      acc.set(p.name, cur);
    }
  }
  return [...acc.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Chip riepilogo carico di lavoro per persona. */
function WorkloadSummary({ occ }: { occ: OccurrenceVM[] }) {
  const rows = minutesByPerson(occ);
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((r) => (
        <span
          key={r.name}
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: r.color ?? "var(--muted-foreground)" }}
          />
          <span className="font-medium">{r.name}</span>
          <span className="text-muted-foreground">{r.minutes} min</span>
        </span>
      ))}
    </div>
  );
}

export default async function TodayPage() {
  const member = await getCurrentMember();

  if (!member) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Non autenticato. Apri HaCleanHouse dal pannello <b>Pulizie</b> di Home
          Assistant per accedere con il tuo utente.
        </CardContent>
      </Card>
    );
  }

  const today = todayUTC();
  const todayISO = today.toISOString().slice(0, 10);

  // Occorrenze virtuali (ricorrenza + eccezioni) nella finestra utile.
  const occ = await listOccurrences({
    houseId: member.houseId,
    from: new Date(today.getTime() - OVERDUE_LOOKBACK_DAYS * MS_PER_DAY),
    to: new Date(today.getTime() + UPCOMING_LOOKAHEAD_DAYS * MS_PER_DAY),
  });

  // Limite superiore del cluster "I prossimi 7 giorni" (la finestra dati è più
  // ampia, vedi UPCOMING_LOOKAHEAD_DAYS, ma qui mostriamo solo una settimana).
  const weekAheadISO = new Date(today.getTime() + 7 * MS_PER_DAY).toISOString().slice(0, 10);

  const overdue = occ.filter((o) => o.dueDate < todayISO && o.status === "PENDING");
  const todays = occ.filter((o) => o.dueDate === todayISO);
  const upcoming = occ.filter(
    (o) => o.dueDate > todayISO && o.dueDate <= weekAheadISO && o.status === "PENDING",
  );

  // Raggruppa le occorrenze future per data (etichetta leggibile).
  const upcomingByDate = new Map<string, OccurrenceVM[]>();
  const dateFmt = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  });
  for (const o of upcoming) {
    const label = dateFmt.format(new Date(`${o.dueDate}T00:00:00Z`));
    const list = upcomingByDate.get(label) ?? [];
    list.push(o);
    upcomingByDate.set(label, list);
  }

  // Raggruppa le occorrenze di oggi per stanza.
  const byRoom = new Map<string, OccurrenceVM[]>();
  for (const o of todays) {
    const list = byRoom.get(o.roomName) ?? [];
    list.push(o);
    byRoom.set(o.roomName, list);
  }

  const doneCount = todays.filter((o) => o.status === "DONE").length;
  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold capitalize tracking-tight">{dateLabel}</h1>
        <p className="text-sm text-muted-foreground">
          Ciao {member.displayName} · {doneCount}/{todays.length} completate
        </p>
      </div>

      {/* Cluster: Oggi — prima i badge dei tempi, poi la lista per stanza. */}
      <section className="space-y-3">
        <WorkloadSummary occ={todays.filter((o) => o.status === "PENDING")} />
        {todays.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nessuna attività per oggi. Crea dei task nella sezione{" "}
              <b>Gestione</b>.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {[...byRoom.entries()].map(([room, items]) => (
              <div key={room} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <RoomIcon icon={items[0]?.roomIcon} />
                  {room}
                </h3>
                <div className="space-y-2">
                  {items.map((o) => (
                    <OccurrenceRow key={o.id} occ={o} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cluster: In ritardo — prima i tempi, poi la lista delle task arretrate. */}
      {overdue.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-2 pb-4">
            <h2 className="font-heading text-lg font-semibold tracking-tight text-destructive">
              In ritardo ({overdue.length})
            </h2>
            <WorkloadSummary occ={overdue} />
            <div className="space-y-2">
              {overdue.map((o) => (
                <OccurrenceRow key={o.id} occ={o} showDate />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cluster: I prossimi 7 giorni — nessun conteggio, solo suddivisione per giornata. */}
      {upcoming.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-2 pb-4">
            <h2 className="font-heading text-lg font-semibold tracking-tight">I prossimi 7 giorni</h2>
            {[...upcomingByDate.entries()].map(([label, items]) => (
              <div key={label} className="space-y-2">
                <h3 className="text-xs font-medium capitalize text-muted-foreground">{label}</h3>
                <div className="space-y-2">
                  {items.map((o) => (
                    <OccurrenceRow key={o.id} occ={o} />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
