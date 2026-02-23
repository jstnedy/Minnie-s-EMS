import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { canAssignRole, requireApiRole } from "@/lib/rbac";
import { employeeUpdateSchema } from "@/lib/validators";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { attendanceLogs: { orderBy: { timeIn: "desc" }, take: 50 } },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  try {
    const parsed = employeeUpdateSchema.parse(await req.json());

    if (parsed.role && !canAssignRole(guard.user.role, parsed.role)) {
      return NextResponse.json({ error: "Forbidden role assignment" }, { status: 403 });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...parsed,
        email: parsed.email === "" ? null : parsed.email,
      },
    });

    if (employee.userId && parsed.role) {
      await prisma.user.update({ where: { id: employee.userId }, data: { role: parsed.role } });
    }

    await auditLog({
      actorId: guard.user.id,
      action: "EMPLOYEE_UPDATE",
      entityType: "Employee",
      entityId: id,
      metadata: parsed,
    });

    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.employee.delete({ where: { id } });

  await auditLog({
    actorId: guard.user.id,
    action: "EMPLOYEE_DELETE",
    entityType: "Employee",
    entityId: id,
    metadata: { employeeId: employee.employeeId },
  });

  return NextResponse.json({ ok: true });
}
