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

// --- Shared hooks / primitives --------------------------------------------

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

function useEntityEditor<T>() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | undefined>(undefined);
  function openNew() { setEditing(undefined); setOpen(true); }
  function openEdit(item: T) { setEditing(item); setOpen(true); }
  function close() { setOpen(false); }
  return { open, setOpen, editing, openNew, openEdit, close };
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

function EntityRow({
  left,
  children,
  badge,
  onEdit,
  onDelete,
  deleteTitle,
  deleteDescription,
}: {
  left?: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteTitle?: string;
  deleteDescription?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-2 transition-colors hover:bg-muted/50">
      {left}
      {children}
      {badge}
      {onEdit && (
        <Button size="icon" variant="ghost" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
      )}
      {onDelete && (
        <ConfirmButton
          size="icon"
          variant="ghost"
          title={deleteTitle ?? "Eliminare?"}
          description={deleteDescription ?? "L'operazione non è reversibile."}
          onConfirm={onDelete}
        >
          <Trash2 className="size-4" />
        </ConfirmButton>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
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
      <FormField label="Nome">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Aspirare salotto" />
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <FormField label="Stanza">
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger><SelectValue placeholder="Stanza" /></SelectTrigger>
            <SelectContent>
              {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Priorità">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Alta</SelectItem>
              <SelectItem value="2">Media</SelectItem>
              <SelectItem value="3">Bassa</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Minuti stimati">
          <Input type="number" min={1} value={estMinutes} onChange={(e) => setEstMinutes(e.target.value)} />
        </FormField>
        <FormField label="Frequenza">
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FREQ_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      {frequency === "EVERY_N_DAYS" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Ogni N giorni">
            <Input type="number" min={1} value={everyNDays} onChange={(e) => setEveryNDays(e.target.value)} />
          </FormField>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Data di inizio">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </FormField>
        <FormField label="Fine">
          <Select value={endMode} onValueChange={(v) => setEndMode(v as "COUNT" | "DATE" | "NEVER")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COUNT">Dopo N occorrenze</SelectItem>
              <SelectItem value="DATE">In data</SelectItem>
              <SelectItem value="NEVER">Mai</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      {endMode !== "NEVER" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {endMode === "COUNT" ? (
            <FormField label="Numero di occorrenze">
              <Input type="number" min={1} value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} />
            </FormField>
          ) : (
            <FormField label="Fino al">
              <Input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
          )}
        </div>
      )}
      {task && (
        <p className="text-xs text-muted-foreground">
          Modificando la <b>data di inizio</b> o le altre proprietà, le modifiche si applicano dalla
          prima occorrenza futura in poi; le occorrenze passate restano invariate.
        </p>
      )}
      <FormField label="Assegnazione">
        <Select value={assignmentMode} onValueChange={setAssignmentMode}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ROTATION">Rotazione</SelectItem>
            <SelectItem value="FIXED">Membri fissi</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {assignmentMode === "FIXED" && (
        <FormField label="Membri">
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
        </FormField>
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
  const { open, setOpen, editing, openNew, openEdit } = useEntityEditor<TaskVM>();
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
        <EntityRow
          key={t.id}
          badge={<Badge variant="outline">{t.estMinutes}m</Badge>}
          onEdit={() => openEdit(t)}
          onDelete={() => run(() => deleteTask(t.id), () => {}, "Task eliminato")}
          deleteTitle="Eliminare il task?"
          deleteDescription={`"${t.name}" e tutte le sue occorrenze verranno rimossi. L'operazione non è reversibile.`}
        >
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
        </EntityRow>
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
  const { open, setOpen, editing, openNew: _openNew, openEdit: _openEdit } = useEntityEditor<RoomVM>();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("mdi:broom");
  const [order, setOrder] = useState("0");

  function openNew() {
    setName(""); setIcon("mdi:broom"); setOrder("0");
    _openNew();
  }
  function openEdit(r: RoomVM) {
    setName(r.name); setIcon(r.icon); setOrder(String(r.order));
    _openEdit(r);
  }
  function submit() {
    run(
      () => (editing ? updateRoom(editing.id, { name, icon, order }) : createRoom({ name, icon, order })),
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
        <EntityRow
          key={r.id}
          left={<RoomIcon icon={r.icon} className="size-5 text-muted-foreground" />}
          onEdit={() => openEdit(r)}
          onDelete={() => run(() => deleteRoom(r.id), () => {}, "Stanza eliminata")}
          deleteTitle="Eliminare la stanza?"
          deleteDescription={`"${r.name}" verrà rimossa. L'operazione non è reversibile.`}
        >
          <span className="flex-1 text-sm">{r.name}</span>
        </EntityRow>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica stanza" : "Nuova stanza"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Cucina" />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Icona">
                <IconPicker value={icon} onChange={setIcon} />
              </FormField>
              <FormField label="Ordine">
                <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
              </FormField>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending || !name}>Salva</Button>
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
  // Solo gli admin gestiscono i membri (vedi requireAdmin lato server). I non-admin
  // vedono l'elenco in sola lettura; il gating UI rispecchia quello del server.
  canManage,
}: {
  members: MemberVM[];
  currentMemberId: string;
  canManage: boolean;
}) {
  const { pending, run } = useAction();
  const { open, setOpen, editing, openNew: _openNew, openEdit: _openEdit } = useEntityEditor<MemberVM>();
  const [haUserId, setHaUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [haPersonEntityId, setHaPersonEntityId] = useState("");
  const [color, setColor] = useState("#3b82f6");

  function openNew() {
    setHaUserId(""); setDisplayName(""); setHaPersonEntityId(""); setColor("#3b82f6");
    _openNew();
  }
  function openEdit(m: MemberVM) {
    setHaUserId(m.haUserId);
    setDisplayName(m.displayName);
    setHaPersonEntityId(m.haPersonEntityId ?? "");
    setColor(m.color);
    _openEdit(m);
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
        <EntityRow
          key={m.id}
          left={<span className="inline-block size-3 rounded-full" style={{ backgroundColor: m.color }} />}
          onEdit={canManage ? () => openEdit(m) : undefined}
          onDelete={canManage && m.id !== currentMemberId
            ? () => run(() => deleteMember(m.id), () => {}, "Membro eliminato")
            : undefined}
          deleteTitle="Eliminare il membro?"
          deleteDescription={`"${m.displayName}" verrà rimosso. L'operazione non è reversibile.`}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {m.displayName} {m.id === currentMemberId && <span className="text-xs text-muted-foreground">(tu)</span>}
            </div>
            <div className="truncate text-xs text-muted-foreground">{m.haUserId}</div>
          </div>
        </EntityRow>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica membro" : "Nuovo membro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Nome visualizzato">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </FormField>
            <FormField label="haUserId">
              <Input
                value={haUserId}
                onChange={(e) => setHaUserId(e.target.value)}
                disabled={!!editing}
                placeholder="ID utente di Home Assistant"
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="person entity (opz.)">
                <Input
                  value={haPersonEntityId}
                  onChange={(e) => setHaPersonEntityId(e.target.value)}
                  placeholder="person.silvia"
                />
              </FormField>
              <FormField label="Colore">
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </FormField>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending || !displayName || !haUserId}>Salva</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
