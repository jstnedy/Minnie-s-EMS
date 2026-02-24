import crypto from "crypto";

const QR_WINDOW_MS = 30 * 60 * 1000;

function kioskSecret() {
  return process.env.QR_KIOSK_SECRET || process.env.NEXTAUTH_SECRET || "dev-kiosk-secret";
}

export function currentQrSlot() {
  return Math.floor(Date.now() / QR_WINDOW_MS);
}

export function qrExpiresAt(slot: number) {
  return new Date((slot + 1) * QR_WINDOW_MS);
}

export function signKioskQr(employeeId: string, slot: number) {
  return crypto.createHmac("sha256", kioskSecret()).update(`${employeeId}:${slot}`).digest("hex");
}

export function verifyKioskQr(employeeId: string, slot: number, signature: string) {
  const nowSlot = currentQrSlot();
  if (slot !== nowSlot) return false;

  const expected = signKioskQr(employeeId, slot);
  const providedBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (providedBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}
