import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKioskQr } from "@/lib/kiosk-qr";
import { validateEmployeePasskey } from "@/lib/passkey";
import { attendancePasskeyVerifySchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const parsed = attendancePasskeyVerifySchema.parse(await req.json());
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
