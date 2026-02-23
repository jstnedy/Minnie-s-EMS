import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attendanceActionSchema } from "@/lib/validators";

async function validatePasskey(employeePk: string, passkey: string) {
  const attempt = await prisma.passkeyAttempt.upsert({
    where: { employeeId: employeePk },
    update: {},
    create: { employeeId: employeePk, attemptsCount: 0 },
  });

  const now = new Date();
  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    return { ok: false, lockedUntil: attempt.lockedUntil };
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeePk } });
  if (!employee) return { ok: false as const };

  const valid = await bcrypt.compare(passkey, employee.passkeyHash);

  if (!valid) {
    const nextAttempts = attempt.attemptsCount + 1;
    const lock = nextAttempts >= 5 ? new Date(now.getTime() + 5 * 60 * 1000) : null;

    await prisma.passkeyAttempt.update({
      where: { employeeId: employeePk },
      data: {
        attemptsCount: lock ? 0 : nextAttempts,
        lockedUntil: lock,
      },
    });

    return { ok: false, lockedUntil: lock ?? undefined };
  }

  await prisma.passkeyAttempt.update({
    where: { employeeId: employeePk },
    data: { attemptsCount: 0, lockedUntil: null },
  });

  return { ok: true };
}

export async function POST(req: Request) {
  try {
    const parsed = attendanceActionSchema.parse(await req.json());

    const employee = await prisma.employee.findUnique({ where: { employeeId: parsed.employeeId } });
    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json({ error: "Employee unavailable" }, { status: 404 });
    }

    const check = await validatePasskey(employee.id, parsed.passkey);
    if (!check.ok) {
      return NextResponse.json(
        { error: "Invalid passkey or temporarily locked", lockedUntil: check.lockedUntil ?? null },
        { status: 401 },
      );
    }

    const openShift = await prisma.attendanceLog.findFirst({
      where: { employeeId: employee.id, timeOut: null },
      orderBy: { timeIn: "desc" },
    });

    if (openShift) {
      return NextResponse.json({ error: "Open shift exists. Please time out first." }, { status: 409 });
    }

    const log = await prisma.attendanceLog.create({
      data: {
        employeeId: employee.id,
        timeIn: new Date(),
        source: "QR",
        deviceInfo: req.headers.get("user-agent") || "unknown",
      },
    });

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
