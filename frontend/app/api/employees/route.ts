import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { canAssignRole, requireApiRole } from "@/lib/rbac";
import { employeeCreateSchema } from "@/lib/validators";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const employeeId = searchParams.get("employeeId") ?? "";

  if (employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      select: { employeeId: true, fullName: true, status: true },
    });

    if (!employee) return NextResponse.json([]);
    return NextResponse.json([employee]);
  }

  const session = await getServerSession(authOptions);
  if (!session?.user || !([UserRole.ADMIN, UserRole.SUPERVISOR] as UserRole[]).includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employees = await prisma.employee.findMany({
    where: q
      ? {
          OR: [
            { employeeId: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(employees);
}

export async function POST(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  try {
    const parsed = employeeCreateSchema.parse(await req.json());

    if (!canAssignRole(guard.user.role, parsed.role)) {
      return NextResponse.json({ error: "Forbidden role assignment" }, { status: 403 });
    }

    const passkeyHash = await bcrypt.hash(parsed.passkey, 10);

    let userId: string | null = null;
    if (parsed.email) {
      const passwordHash = await bcrypt.hash("Temp1234!", 10);
      const user = await prisma.user.create({
        data: {
          email: parsed.email,
          passwordHash,
          role: parsed.role,
        },
      });
      userId = user.id;
    }

    const employee = await prisma.employee.create({
      data: {
        employeeId: parsed.employeeId,
        fullName: parsed.fullName,
        email: parsed.email || null,
        contactNumber: parsed.contactNumber || null,
        role: parsed.role,
        passkeyHash,
        hourlyRate: parsed.hourlyRate,
        status: parsed.status,
        userId,
        mustChangePasskey: true,
      },
    });

    await auditLog({
      actorId: guard.user.id,
      action: "EMPLOYEE_CREATE",
      entityType: "Employee",
      entityId: employee.id,
      metadata: { employeeId: employee.employeeId },
    });

    return NextResponse.json({ employee, tempPassword: parsed.email ? "Temp1234!" : null }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
