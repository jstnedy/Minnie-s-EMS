import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireApiRole } from "@/lib/rbac";
import { currentQrSlot, qrExpiresAt, signKioskQr } from "@/lib/kiosk-qr";

export async function GET(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const { searchParams, origin } = new URL(req.url);
  const employeeId = searchParams.get("employeeId")?.trim() ?? "";

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const slot = currentQrSlot();
  const signature = signKioskQr(employeeId, slot);
  const baseUrl = process.env.APP_BASE_URL || origin;
  const kioskUrl = new URL("/kiosk", baseUrl);
  kioskUrl.searchParams.set("employeeId", employeeId);
  kioskUrl.searchParams.set("slot", String(slot));
  kioskUrl.searchParams.set("sig", signature);

  return NextResponse.json({
    employeeId,
    slot,
    signature,
    expiresAt: qrExpiresAt(slot).toISOString(),
    qrValue: kioskUrl.toString(),
  });
}
