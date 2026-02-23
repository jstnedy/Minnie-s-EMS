import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/rbac";
import { employeeCreateSchema } from "@/lib/validators";

function composeName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

async function generateEmployeeId() {
  const year = new Date().getFullYear();
  const prefix = `EMP-${year}-`;

  const latest = await prisma.employee.findFirst({
    where: { employeeId: { startsWith: prefix } },
    orderBy: { employeeId: "desc" },
    select: { employeeId: true },
  });

  const latestSeq = latest ? Number(latest.employeeId.slice(-6)) : 0;
  const nextSeq = latestSeq + 1;
  return `${prefix}${String(nextSeq).padStart(6, "0")}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const employeeId = searchParams.get("employeeId")?.trim() ?? "";

  if (employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    if (!employee) return NextResponse.json([]);
    return NextResponse.json([
      {
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: composeName(employee.firstName, employee.lastName),
        status: employee.status,
      },
    ]);
  }

  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE]);
  if ("error" in guard) return guard.error;

  const employees = await prisma.employee.findMany({
    where: q
      ? {
          OR: [
            { employeeId: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { role: true },
    orderBy: { employeeId: "asc" },
  });

  return NextResponse.json(
    employees.map((employee) => ({
      ...employee,
      fullName: composeName(employee.firstName, employee.lastName),
    })),
  );
}

export async function POST(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE]);
  if ("error" in guard) return guard.error;

  try {
    const parsed = employeeCreateSchema.parse(await req.json());

    const role = await prisma.role.findUnique({ where: { id: parsed.roleId } });
    if (!role || !role.isActive) {
      return NextResponse.json({ error: "Selected role is unavailable" }, { status: 400 });
    }

    const passkeyHash = await bcrypt.hash(parsed.passkey, 10);

    let userId: string | null = null;
    if (parsed.email) {
      const passwordHash = await bcrypt.hash("Temp1234!", 10);
      const user = await prisma.user.create({
        data: {
          email: parsed.email,
          passwordHash,
          role: UserRole.EMPLOYEE,
        },
      });
      userId = user.id;
    }

    let employee = null;
    for (let i = 0; i < 5; i += 1) {
      const generatedEmployeeId = await generateEmployeeId();
      try {
        employee = await prisma.employee.create({
          data: {
            employeeId: generatedEmployeeId,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            email: parsed.email || null,
            contactNumber: parsed.contactNumber || null,
            roleId: parsed.roleId,
            passkeyHash,
            hourlyRate: parsed.hourlyRate,
            status: parsed.status,
            userId,
            mustChangePasskey: true,
          },
          include: { role: true },
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(",") : String(error.meta?.target ?? "");
          if (target.includes("employee_id") || target.includes("employeeId")) {
            continue;
          }
        }
        throw error;
      }
    }

    if (!employee) {
      return NextResponse.json({ error: "Unable to generate unique employee ID" }, { status: 500 });
    }

    try {
      await auditLog({
        actorId: guard.user.id,
        action: "EMPLOYEE_CREATE",
        entityType: "Employee",
        entityId: employee.id,
        metadata: { employeeId: employee.employeeId },
      });
    } catch {
      // Do not block employee creation if audit table is missing.
    }

    return NextResponse.json(
      {
        employee: {
          ...employee,
          fullName: composeName(employee.firstName, employee.lastName),
        },
        generatedEmployeeId: employee.employeeId,
        tempPassword: parsed.email ? "Temp1234!" : null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
