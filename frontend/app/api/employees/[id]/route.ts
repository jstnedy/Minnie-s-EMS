import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/rbac";
import { employeeUpdateSchema } from "@/lib/validators";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { role: true, attendanceLogs: { orderBy: { timeIn: "desc" }, take: 50 } },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...employee,
    fullName: `${employee.firstName} ${employee.lastName}`.trim(),
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  try {
    const parsed = employeeUpdateSchema.parse(await req.json());

    if (parsed.roleId) {
      const role = await prisma.role.findUnique({ where: { id: parsed.roleId } });
      if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email === "" ? null : parsed.email,
        contactNumber: parsed.contactNumber,
        roleId: parsed.roleId,
        hourlyRate: parsed.hourlyRate,
        status: parsed.status,
      },
      include: { role: true },
    });

    await auditLog({
      actorId: guard.user.id,
      action: "EMPLOYEE_UPDATE",
      entityType: "Employee",
      entityId: id,
      metadata: parsed,
    });

    return NextResponse.json({
      ...employee,
      fullName: `${employee.firstName} ${employee.lastName}`.trim(),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
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
