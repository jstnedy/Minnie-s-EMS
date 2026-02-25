import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function validateEmployeePasskey(employeePk: string, passkey: string) {
  const attempt = await prisma.passkeyAttempt.upsert({
    where: { employeeId: employeePk },
    update: {},
    create: { employeeId: employeePk, attemptsCount: 0 },
  });

  const now = new Date();
  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    return { ok: false as const, lockedUntil: attempt.lockedUntil };
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

    return { ok: false as const, lockedUntil: lock ?? undefined };
  }

  await prisma.passkeyAttempt.update({
    where: { employeeId: employeePk },
    data: { attemptsCount: 0, lockedUntil: null },
  });

  return { ok: true as const };
}
