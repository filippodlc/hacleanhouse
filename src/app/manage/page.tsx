import { prisma } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { RoomManager, MemberManager, TaskManager } from "@/components/manage-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const member = await getCurrentMember();
  if (!member) {
    // Non autenticato: la rotta non deve essere raggiungibile → torna alla home
    // (che mostra la schermata di accesso generica).
    redirect("/");
  }

  const [rooms, members, tasks] = await Promise.all([
    prisma.room.findMany({ where: { houseId: member.houseId }, orderBy: { order: "asc" } }),
    prisma.member.findMany({ where: { houseId: member.houseId }, orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({
      where: { houseId: member.houseId },
      include: { room: true, assignees: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const roomOptions = rooms.map((r) => ({ id: r.id, name: r.name }));
  const memberOptions = members.map((m) => ({ id: m.id, name: m.displayName }));

  return (
    <div className="space-y-8">
      <TaskManager
        tasks={tasks.map((t) => ({
          id: t.id,
          name: t.name,
          roomId: t.roomId,
          roomName: t.room.name,
          frequency: t.frequency,
          everyNDays: t.everyNDays,
          startDate: t.startDate.toISOString().slice(0, 10),
          repeatCount: t.repeatCount,
          endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : null,
          assignmentMode: t.assignmentMode,
          assignedMemberIds: t.assignees.map((a) => a.id),
          assigneeNames: t.assignees.map((a) => a.displayName),
          active: t.active,
        }))}
        rooms={roomOptions}
        members={memberOptions}
      />
      <RoomManager rooms={rooms.map((r) => ({ id: r.id, name: r.name, icon: r.icon, order: r.order }))} />
      <MemberManager
        members={members.map((m) => ({
          id: m.id,
          haUserId: m.haUserId,
          displayName: m.displayName,
          haPersonEntityId: m.haPersonEntityId,
          color: m.color,
        }))}
        currentMemberId={member.id}
        canManage={member.isAdmin}
      />
    </div>
  );
}
