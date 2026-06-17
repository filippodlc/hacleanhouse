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

  const overdue = occ.filter((o) => o.dueDate < todayISO && o.status === "PENDING");
  const todays = occ.filter((o) => o.dueDate === todayISO);
  const upcoming = occ.filter((o) => o.dueDate > todayISO && o.status === "PENDING");

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
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold capitalize tracking-tight">{dateLabel}</h1>
        <p className="text-sm text-muted-foreground">
          Ciao {member.displayName} · {doneCount}/{todays.length} completate
        </p>
      </div>

      {overdue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-destructive">
            In ritardo ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((o) => (
              <OccurrenceRow key={o.id} occ={o} showDate />
            ))}
          </div>
        </section>
      )}

      {todays.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nessuna attività per oggi. Crea dei task nella sezione{" "}
            <b>Gestione</b>.
          </CardContent>
        </Card>
      ) : (
        [...byRoom.entries()].map(([room, items]) => (
          <section key={room} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <RoomIcon icon={items[0]?.roomIcon} />
              {room}
            </h2>
            <div className="space-y-2">
              {items.map((o) => (
                <OccurrenceRow key={o.id} occ={o} />
              ))}
            </div>
          </section>
        ))
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Prossime ({upcoming.length})
          </h2>
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
        </section>
      )}
    </div>
  );
}
