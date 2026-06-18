"use client";

import {
  createMember,
  createRoom,
  createTask,
  deleteMember,
  deleteRoom,
  deleteTask,
  updateMember,
  updateRoom,
  updateTask,
} from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { IconPicker } from "@/components/icon-picker";
import { RoomIcon } from "@/components/room-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

type Option = { id: string; name: string };

function useAction() {
  const [pending, startTransition] = useTransition();
  function run(fn: () => Promise<unknown>, onOk: () => void, okMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        onOk();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Operazione non riuscita");
      }
    });
  }
  return { pending, run };
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

/* ----------------------------- Task ----------------------------- */

type TaskVM = {
  id: string;
  name: string;
  roomId: string;
  roomName: string;
  priority: number;
  estMinutes: number;
  frequency: string;
  everyNDays: number | null;
  startDate: string; // YYYY-MM-DD
  repeatCount: number | null;
  endDate: string | null; // YYYY-MM-DD
  assignmentMode: string;
  assignedMemberIds: string[];
  assigneeNames: string[];
  active: boolean;
};

/** Data odierna in formato YYYY-MM-DD (UTC) per i campi <input type="date">. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const FREQ_LABEL: Record<string, string> = {
  DAILY: "Giornaliera",
  WEEKLY: "Settimanale",
  MONTHLY: "Mensile",
  EVERY_N_DAYS: "Ogni N giorni",
};

function TaskForm({
  task,
  rooms,
  members,
  onClose,
}: {
  task?: TaskVM;
  rooms: Option[];
  members: Option[];
  onClose: () => void;
}) {
  const { pending, run } = useAction();
  const [name, setName] = useState(task?.name ?? "");
  const [roomId, setRoomId] = useState(task?.roomId ?? rooms[0]?.id ?? "");
  const [priority, setPriority] = useState(String(task?.priority ?? 2));
  const [estMinutes, setEstMinutes] = useState(String(task?.estMinutes ?? 10));
  const [frequency, setFrequency] = useState(task?.frequency ?? "WEEKLY");
  const [everyNDays, setEveryNDays] = useState(String(task?.everyNDays ?? 2));
  const [startDate, setStartDate] = useState(task?.startDate ?? todayISO());
  const initialEndMode: "COUNT" | "DATE" | "NEVER" = task
    ? task.endDate
      ? "DATE"
      : task.repeatCount != null
        ? "COUNT"
        : "NEVER"
    : "COUNT";
  const [endMode, setEndMode] = useState<"COUNT" | "DATE" | "NEVER">(initialEndMode);
  const [repeatCount, setRepeatCount] = useState(String(task?.repeatCount ?? 4));
  const [endDate, setEndDate] = useState(task?.endDate ?? "");
  const [assignmentMode, setAssignmentMode] = useState(task?.assignmentMode ?? "FIXED");
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>(
    task?.assignedMemberIds ?? [],
  );

  function toggleAssignee(id: string) {
    setAssignedMemberIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  function submit() {
    const payload = {
      name,
      roomId,
      priority,
      estMinutes,
      frequency: frequency as never,
      everyNDays: frequency === "EVERY_N_DAYS" ? everyNDays : undefined,
      startDate,
      endMode,
      repeatCount: endMode === "COUNT" ? repeatCount : undefined,
      endDate: endMode === "DATE" ? endDate : "",
      assignmentMode: assignmentMode as never,
      assignedMemberIds: assignmentMode === "FIXED" ? assignedMemberIds : [],
      active: true,
    };
    run(
      () => (task ? updateTask(task.id, payload) : createTask(payload)),
      onClose,
      task ? "Task aggiornato" : "Task creato",
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Aspirare salotto" />
      </div>      
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label>Stanza</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger><SelectValue placeholder="Stanza" /></SelectTrigger>
            <SelectContent>
              {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Priorità</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Alta</SelectItem>
              <SelectItem value="2">Media</SelectItem>
              <SelectItem value="3">Bassa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
        <Label>Minuti stimati</Label>
          <Input type="number" min={1} value={estMinutes} onChange={(e) => setEstMinutes(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Frequenza</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FREQ_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {frequency === "EVERY_N_DAYS" && (
          <div className="space-y-1">
            <Label>Ogni N giorni</Label>
            <Input type="number" min={1} value={everyNDays} onChange={(e) => setEveryNDays(e.target.value)} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Data di inizio</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Fine</Label>
          <Select value={endMode} onValueChange={(v) => setEndMode(v as "COUNT" | "DATE" | "NEVER")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COUNT">Dopo N occorrenze</SelectItem>
              <SelectItem value="DATE">In data</SelectItem>
              <SelectItem value="NEVER">Mai</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {endMode !== "NEVER" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {endMode === "COUNT" ? (
            <div className="space-y-1">
              <Label>Numero di occorrenze</Label>
              <Input type="number" min={1} value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Fino al</Label>
              <Input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
        </div>
      )}
      {task && (
        <p className="text-xs text-muted-foreground">
          Modificando la <b>data di inizio</b> o le altre proprietà, le modifiche si applicano dalla
          prima occorrenza futura in poi; le occorrenze passate restano invariate.
        </p>
      )}
      <div className="space-y-1">
        <Label>Assegnazione</Label>
        <Select value={assignmentMode} onValueChange={setAssignmentMode}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ROTATION">Rotazione</SelectItem>
            <SelectItem value="FIXED">Membri fissi</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {assignmentMode === "FIXED" && (
        <div className="space-y-1">
          <Label>Membri</Label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = assignedMemberIds.includes(m.id);
              return (
                <Button
                  key={m.id}
                  type="button"
                  size="sm"
                  variant={on ? "default" : "outline"}
                  onClick={() => toggleAssignee(m.id)}
                >
                  {m.name}
                </Button>
              );
            })}
          </div>
          {members.length === 0 && (
            <p className="text-xs text-muted-foreground">Nessun membro disponibile.</p>
          )}
        </div>
      )}
      <DialogFooter>
        <Button
          onClick={submit}
          disabled={
            pending ||
            !name ||
            !roomId ||
            (assignmentMode === "FIXED" && assignedMemberIds.length === 0)
          }
        >
          Salva
        </Button>
      </DialogFooter>
    </div>
  );
}

export function TaskManager({
  tasks,
  rooms,
  members,
}: {
  tasks: TaskVM[];
  rooms: Option[];
  members: Option[];
}) {
  const { run } = useAction();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskVM | undefined>(undefined);

  function openNew() {
    setEditing(undefined);
    setOpen(true);
  }
  function openEdit(t: TaskVM) {
    setEditing(t);
    setOpen(true);
  }

  const canAdd = rooms.length > 0;

  return (
    <SectionCard
      title="Attività ricorrenti"
      action={
        <Button size="sm" onClick={openNew} disabled={!canAdd} title={canAdd ? "" : "Crea prima una stanza"}>
          <Plus className="size-4" /> Nuovo
        </Button>
      }
    >
      {tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun task. {canAdd ? "" : "Crea prima una stanza."}</p>
      )}
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-md border p-2 transition-colors hover:bg-muted/50">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{t.name}</div>
            <div className="text-xs text-muted-foreground">
              {t.roomName} · {FREQ_LABEL[t.frequency]}
              {t.frequency === "EVERY_N_DAYS" ? ` (${t.everyNDays})` : ""} ·{" "}
              {t.assignmentMode === "FIXED"
                ? t.assigneeNames.length
                  ? t.assigneeNames.join(", ")
                  : "—"
                : "Rotazione"}
            </div>
          </div>
          <Badge variant="outline">{t.estMinutes}m</Badge>
          <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
            <Pencil className="size-4" />
          </Button>
          <ConfirmButton
            size="icon"
            variant="ghost"
            title="Eliminare il task?"
            description={`"${t.name}" e tutte le sue occorrenze verranno rimossi. L'operazione non è reversibile.`}
            onConfirm={() => run(() => deleteTask(t.id), () => {}, "Task eliminato")}
          >
            <Trash2 className="size-4" />
          </ConfirmButton>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica task" : "Nuovo task"}</DialogTitle>
          </DialogHeader>
          <TaskForm
            task={editing}
            rooms={rooms}
            members={members}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/* ----------------------------- Stanze ----------------------------- */

type RoomVM = { id: string; name: string; icon: string; order: number };

export function RoomManager({ rooms }: { rooms: RoomVM[] }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoomVM | undefined>();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("mdi:broom");
  const [order, setOrder] = useState("0");

  function openNew() {
    setEditing(undefined);
    setName("");
    setIcon("mdi:broom");
    setOrder("0");
    setOpen(true);
  }
  function openEdit(r: RoomVM) {
    setEditing(r);
    setName(r.name);
    setIcon(r.icon);
    setOrder(String(r.order));
    setOpen(true);
  }
  function submit() {
    const payload = { name, icon, order };
    run(
      () => (editing ? updateRoom(editing.id, payload) : createRoom(payload)),
      () => setOpen(false),
      editing ? "Stanza aggiornata" : "Stanza creata",
    );
  }

  return (
    <SectionCard
      title="Stanze"
      action={
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" /> Nuova
        </Button>
      }
    >
      {rooms.length === 0 && <p className="text-sm text-muted-foreground">Nessuna stanza.</p>}
      {rooms.map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-md border p-2 transition-colors hover:bg-muted/50">
          <RoomIcon icon={r.icon} className="size-5 text-muted-foreground" />
          <span className="flex-1 text-sm">{r.name}</span>
          <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
            <Pencil className="size-4" />
          </Button>
          <ConfirmButton
            size="icon"
            variant="ghost"
            title="Eliminare la stanza?"
            description={`"${r.name}" verrà rimossa. L'operazione non è reversibile.`}
            onConfirm={() => run(() => deleteRoom(r.id), () => {}, "Stanza eliminata")}
          >
            <Trash2 className="size-4" />
          </ConfirmButton>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica stanza" : "Nuova stanza"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Cucina" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Icona</Label>
                <IconPicker value={icon} onChange={setIcon} />
              </div>
              <div className="space-y-1">
                <Label>Ordine</Label>
                <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending || !name}>
                Salva
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/* ----------------------------- Membri ----------------------------- */

type MemberVM = {
  id: string;
  haUserId: string;
  displayName: string;
  haPersonEntityId: string | null;
  color: string;
};

export function MemberManager({
  members,
  currentMemberId,
  canManage,
}: {
  members: MemberVM[];
  currentMemberId: string;
  // Solo gli admin gestiscono i membri (vedi requireAdmin lato server). I non-admin
  // vedono l'elenco in sola lettura; il gating UI rispecchia quello del server.
  canManage: boolean;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MemberVM | undefined>();
  const [haUserId, setHaUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [haPersonEntityId, setHaPersonEntityId] = useState("");
  const [color, setColor] = useState("#3b82f6");

  function openNew() {
    setEditing(undefined);
    setHaUserId("");
    setDisplayName("");
    setHaPersonEntityId("");
    setColor("#3b82f6");
    setOpen(true);
  }
  function openEdit(m: MemberVM) {
    setEditing(m);
    setHaUserId(m.haUserId);
    setDisplayName(m.displayName);
    setHaPersonEntityId(m.haPersonEntityId ?? "");
    setColor(m.color);
    setOpen(true);
  }
  function submit() {
    const payload = { haUserId, displayName, haPersonEntityId, color };
    run(
      () => (editing ? updateMember(editing.id, payload) : createMember(payload)),
      () => setOpen(false),
      editing ? "Membro aggiornato" : "Membro creato",
    );
  }

  return (
    <SectionCard
      title="Membri"
      action={
        canManage ? (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> Nuovo
          </Button>
        ) : null
      }
    >
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-2 rounded-md border p-2 transition-colors hover:bg-muted/50">
          <span className="inline-block size-3 rounded-full" style={{ backgroundColor: m.color }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {m.displayName} {m.id === currentMemberId && <span className="text-xs text-muted-foreground">(tu)</span>}
            </div>
            <div className="truncate text-xs text-muted-foreground">{m.haUserId}</div>
          </div>
          {canManage && (
            <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
              <Pencil className="size-4" />
            </Button>
          )}
          {canManage && m.id !== currentMemberId && (
            <ConfirmButton
              size="icon"
              variant="ghost"
              title="Eliminare il membro?"
              description={`"${m.displayName}" verrà rimosso. L'operazione non è reversibile.`}
              onConfirm={() => run(() => deleteMember(m.id), () => {}, "Membro eliminato")}
            >
              <Trash2 className="size-4" />
            </ConfirmButton>
          )}
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica membro" : "Nuovo membro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome visualizzato</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>haUserId</Label>
              <Input
                value={haUserId}
                onChange={(e) => setHaUserId(e.target.value)}
                disabled={!!editing}
                placeholder="ID utente di Home Assistant"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>person entity (opz.)</Label>
                <Input
                  value={haPersonEntityId}
                  onChange={(e) => setHaPersonEntityId(e.target.value)}
                  placeholder="person.silvia"
                />
              </div>
              <div className="space-y-1">
                <Label>Colore</Label>
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending || !displayName || !haUserId}>
                Salva
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
