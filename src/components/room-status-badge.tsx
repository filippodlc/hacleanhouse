"use client";

import { FreshnessBar, freshnessColor, freshnessLabel } from "@/components/freshness-bar";
import { RoomIcon } from "@/components/room-icon";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import type { RoomFreshnessVM, TaskFreshnessVM } from "@/lib/freshness";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Rome",
});

function fmtDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}

/** Riga di dettaglio per singola ricorrenza con la sua barra. */
function TaskRow({ task }: { task: TaskFreshnessVM }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{task.taskName}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {freshnessLabel(task.freshness, task.overdueDays)}
          {task.overdueDays > 0 ? ` · ${task.overdueDays}g` : ""}
        </span>
      </div>
      <FreshnessBar value={task.freshness} overdueDays={task.overdueDays} />
      <p className="text-xs text-muted-foreground">
        {task.lastCleanISO ? `Ultima: ${fmtDate(task.lastCleanISO)}` : "Mai completata"}{" "}
        · Prossima: {fmtDate(task.nextDueISO)}
      </p>
    </div>
  );
}

/**
 * Chip stato pulizia di una stanza (icona + nome + pallino colorato). Cliccando
 * apre un dialog con il dettaglio per ricorrenza (barre + date).
 */
export function RoomStatusBadge({ room }: { room: RoomFreshnessVM }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
        >
          <span className={cn("size-2 shrink-0 rounded-full", freshnessColor(room.freshness))} />
          <RoomIcon icon={room.roomIcon} className="size-3.5" />
          <span className="font-medium">{room.roomName}</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", freshnessColor(room.freshness))} />
            <RoomIcon icon={room.roomIcon} />
            {room.roomName}
          </DialogTitle>
          <DialogDescription>
            Stato pulizia · {freshnessLabel(room.freshness)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {room.tasks.map((t) => (
            <TaskRow key={t.taskId} task={t} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
