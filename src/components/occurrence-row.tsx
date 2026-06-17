"use client";

import {
    completeOccurrence,
    getRescheduleBounds,
    pushOccurrenceToCalendar,
    removeOccurrenceFromCalendar,
    reopenOccurrence,
    rescheduleOccurrence,
    skipOccurrence,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarPlus, CalendarX, Check, RotateCcw, SkipForward } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export type OccurrenceVM = {
  id: string;
  taskName: string;
  roomName: string;
  priority: number; // 1 alta, 2 media, 3 bassa
  estMinutes: number;
  status: "PENDING" | "DONE" | "SKIPPED";
  assignees: { name: string; color: string | null }[];
  dueDate: string;
  onCalendar: boolean;
};

const PRIORITY = {
  1: { label: "Alta", variant: "destructive" as const, accent: "border-l-destructive" },
  2: { label: "Media", variant: "secondary" as const, accent: "border-l-primary" },
  3: { label: "Bassa", variant: "outline" as const, accent: "border-l-border" },
};

export function OccurrenceRow({
  occ,
  showDate = false,
}: {
  occ: OccurrenceVM;
  showDate?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [skipOpen, setSkipOpen] = useState(false);
  const [bounds, setBounds] = useState<{ min: string | null; max: string | null } | null>(null);
  const [newDate, setNewDate] = useState("");
  const done = occ.status === "DONE";
  const skipped = occ.status === "SKIPPED";
  const prio = PRIORITY[occ.priority as 1 | 2 | 3] ?? PRIORITY[2];

  function run(fn: () => Promise<unknown>, okMsg?: string, onOk?: () => void) {
    startTransition(async () => {
      try {
        const res = (await fn()) as { ok?: boolean; error?: string } | undefined;
        if (res && res.ok === false) {
          toast.error(res.error ?? "Operazione non riuscita");
          return;
        }
        if (okMsg) toast.success(okMsg);
        onOk?.();
      } catch {
        toast.error("Operazione non riuscita");
      }
    });
  }

  // Apre la modale di skip e carica l'intervallo valido per la ripianificazione.
  function openSkip() {
    setNewDate("");
    setBounds(null);
    setSkipOpen(true);
    getRescheduleBounds(occ.id).then(setBounds);
  }

  // Ripianificazione possibile solo se esiste almeno un giorno tra questa e la
  // prossima occorrenza (max assente = serie infinita/ultima → sempre possibile).
  const canReschedule = !!bounds?.min && (bounds.max === null || bounds.max >= bounds.min);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-l-2 bg-card p-3 shadow-sm transition-all hover:shadow-md ${prio.accent} ${
        done ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() => (done ? reopenOccurrence(occ.id) : completeOccurrence(occ.id)))
        }
        aria-label={done ? "Riapri" : "Segna come fatto"}
        className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-90 ${
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "hover:border-primary hover:bg-accent"
        }`}
      >
        {done ? <Check className="size-5 animate-in zoom-in-50 duration-200" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-sm font-medium ${
            done || skipped ? "line-through" : ""
          }`}
        >
          {occ.taskName}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{occ.estMinutes} min</span>
          {showDate && <span>· {occ.dueDate}</span>}
          {occ.assignees.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              ·
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: a.color ?? "#999" }}
              />
              {a.name}
            </span>
          ))}
          {skipped && <span>· saltata</span>}
        </div>
      </div>

      <Badge variant={prio.variant} className="shrink-0">
        {prio.label}
      </Badge>

      <div className="flex shrink-0 gap-1">
        {occ.onCalendar ? (
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            title="Rimuovi dal calendario"
            onClick={() => run(() => removeOccurrenceFromCalendar(occ.id), "Rimosso dal calendario")}
          >
            <CalendarX className="size-4 text-primary" />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            title="Aggiungi al calendario"
            onClick={() => run(() => pushOccurrenceToCalendar(occ.id), "Aggiunto al calendario")}
          >
            <CalendarPlus className="size-4" />
          </Button>
        )}
        {!done && !skipped && (
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            title="Salta o ripianifica"
            onClick={openSkip}
          >
            <SkipForward className="size-4" />
          </Button>
        )}
        {(done || skipped) && (
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            title="Riapri"
            onClick={() => run(() => reopenOccurrence(occ.id))}
          >
            <RotateCcw className="size-4" />
          </Button>
        )}
      </div>

      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{occ.taskName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vuoi saltare questa occorrenza o ripianificarla a un altro giorno?
            </p>
            <div className="space-y-1">
              <Label>Ripianifica al</Label>
              <Input
                type="date"
                value={newDate}
                min={bounds?.min ?? undefined}
                max={bounds?.max ?? undefined}
                disabled={!canReschedule}
                onChange={(e) => setNewDate(e.target.value)}
              />
              {bounds && !canReschedule && (
                <p className="text-xs text-muted-foreground">
                  Nessuna data disponibile prima dell&apos;occorrenza successiva.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => skipOccurrence(occ.id), "Occorrenza saltata", () => setSkipOpen(false))}
            >
              Salta
            </Button>
            <Button
              disabled={pending || !canReschedule || !newDate}
              onClick={() =>
                run(
                  () => rescheduleOccurrence(occ.id, newDate),
                  "Occorrenza ripianificata",
                  () => setSkipOpen(false),
                )
              }
            >
              Ripianifica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
