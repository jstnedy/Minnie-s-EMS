import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKioskQr } from "@/lib/kiosk-qr";
import { attendanceActionSchema } from "@/lib/validators";
import { validateEmployeePasskey } from "@/lib/passkey";

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

    const check = await validateEmployeePasskey(employee.id, parsed.passkey);
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
        timeInPhoto: parsed.photoDataUrl,
      },
    });

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
