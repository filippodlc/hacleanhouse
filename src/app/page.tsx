import { OccurrenceRow, type OccurrenceVM } from "@/components/occurrence-row";
import { RoomIcon } from "@/components/room-icon";
import { RoomStatusBadge } from "@/components/room-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Unauthenticated } from "@/components/unauthenticated";
import { getCurrentMember } from "@/lib/auth";
import { listRoomFreshness } from "@/lib/freshness";
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
    return <Unauthenticated />;
  }

  const today = todayUTC();
  const todayISO = today.toISOString().slice(0, 10);

  // Occorrenze virtuali (ricorrenza + eccezioni) nella finestra utile + stato
  // di pulizia per stanza (riepilogo compatto, dettaglio su /stato).
  const [occ, roomFreshness] = await Promise.all([
    listOccurrences({
      houseId: member.houseId,
      from: new Date(today.getTime() - OVERDUE_LOOKBACK_DAYS * MS_PER_DAY),
      to: new Date(today.getTime() + UPCOMING_LOOKAHEAD_DAYS * MS_PER_DAY),
    }),
    listRoomFreshness({ houseId: member.houseId }),
  ]);

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
      {/* Riepilogo stato pulizia: un badge per stanza, clic = dettaglio per task. */}
      {roomFreshness.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b pt-2 pb-6">
          {roomFreshness.map((room) => (
            <RoomStatusBadge key={room.roomId} room={room} />
          ))}
        </div>
      )}

      <div>
        <h1 className="font-heading text-2xl font-semibold capitalize tracking-tight">{dateLabel}</h1>
        <p className="text-sm text-muted-foreground">
          Ciao {member.displayName} · {doneCount}/{todays.length} completate
        </p>
      </div>

      {/* Cluster: Oggi */}
      <section className="space-y-3">
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

      {/* Cluster: In ritardo */}
      {overdue.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-2 pb-4">
            <h2 className="font-heading text-lg font-semibold tracking-tight text-destructive">
              In ritardo ({overdue.length})
            </h2>
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
