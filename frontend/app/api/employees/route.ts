import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
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
    orderBy: { employeeId: "asc" },
  });

  return NextResponse.json(employees);
}

export async function POST(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  try {
    const parsed = employeeCreateSchema.parse(await req.json());
    const normalizedEmployeeId = parsed.employeeId.trim().toUpperCase();

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
        employeeId: normalizedEmployeeId,
        fullName: parsed.fullName.trim(),
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

    try {
      await auditLog({
        actorId: guard.user.id,
        action: "EMPLOYEE_CREATE",
        entityType: "Employee",
        entityId: employee.id,
        metadata: { employeeId: employee.employeeId },
      });
    } catch {
      // Do not block employee creation if audit table is missing or not yet migrated.
    }

    return NextResponse.json({ employee, tempPassword: parsed.email ? "Temp1234!" : null }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Employee ID or email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
