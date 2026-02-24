import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKioskQr } from "@/lib/kiosk-qr";
import { attendanceActionSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const parsed = attendanceActionSchema.parse(await req.json());
    if (!verifyKioskQr(parsed.employeeId, parsed.qrSlot, parsed.qrSig)) {
      return NextResponse.json({ error: "QR code expired or invalid" }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({ where: { employeeId: parsed.employeeId } });
    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json({ error: "Employee unavailable" }, { status: 404 });
    }

    const attempt = await prisma.passkeyAttempt.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: { employeeId: employee.id, attemptsCount: 0 },
    });

    const now = new Date();
    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      return NextResponse.json(
        { error: "Locked due to failed attempts", lockedUntil: attempt.lockedUntil },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(parsed.passkey, employee.passkeyHash);
    if (!valid) {
      const nextAttempts = attempt.attemptsCount + 1;
      const lock = nextAttempts >= 5 ? new Date(now.getTime() + 5 * 60 * 1000) : null;
      await prisma.passkeyAttempt.update({
        where: { employeeId: employee.id },
        data: {
          attemptsCount: lock ? 0 : nextAttempts,
          lockedUntil: lock,
        },
      });
      return NextResponse.json({ error: "Invalid passkey", lockedUntil: lock }, { status: 401 });
    }

    await prisma.passkeyAttempt.update({
      where: { employeeId: employee.id },
      data: { attemptsCount: 0, lockedUntil: null },
    });

    const openShift = await prisma.attendanceLog.findFirst({
      where: { employeeId: employee.id, timeOut: null },
      orderBy: { timeIn: "desc" },
    });

    if (!openShift) {
      return NextResponse.json({ error: "No open shift to time out" }, { status: 409 });
    }

    const log = await prisma.attendanceLog.update({
      where: { id: openShift.id },
      data: {
        timeOut: now,
        deviceInfo: req.headers.get("user-agent") || openShift.deviceInfo,
        timeOutPhoto: parsed.photoDataUrl,
      },
    });

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
