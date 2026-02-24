import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attendanceEditSchema } from "@/lib/validators";
import { auditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/rbac";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  try {
    const parsed = attendanceEditSchema.parse(await req.json());

    const updated = await prisma.attendanceLog.update({
      where: { id },
      data: {
        timeIn: new Date(parsed.timeIn),
        timeOut: parsed.timeOut ? new Date(parsed.timeOut) : null,
        editedBy: guard.user.id,
        editedAt: new Date(),
        editReason: parsed.editReason,
      },
    });

    await auditLog({
      actorId: guard.user.id,
      action: "ATTENDANCE_EDIT",
      entityType: "AttendanceLog",
      entityId: id,
      metadata: parsed,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;
  const existing = await prisma.attendanceLog.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.attendanceLog.delete({ where: { id } });

  await auditLog({
    actorId: guard.user.id,
    action: "ATTENDANCE_DELETE",
    entityType: "AttendanceLog",
    entityId: id,
    metadata: {
      employeeId: existing.employeeId,
      timeIn: existing.timeIn.toISOString(),
      timeOut: existing.timeOut ? existing.timeOut.toISOString() : null,
    },
  });

  return NextResponse.json({ ok: true });
}
