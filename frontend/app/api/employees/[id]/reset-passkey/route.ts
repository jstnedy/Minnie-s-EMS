import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/rbac";
import { passkeyResetSchema } from "@/lib/validators";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  try {
    const parsed = passkeyResetSchema.parse(await req.json());
    const passkeyHash = await bcrypt.hash(parsed.tempPasskey, 10);

    const employee = await prisma.employee.update({
      where: { id },
      data: { passkeyHash, mustChangePasskey: true },
    });

    await prisma.passkeyAttempt.upsert({
      where: { employeeId: id },
      update: { attemptsCount: 0, lockedUntil: null },
      create: { employeeId: id, attemptsCount: 0, lockedUntil: null },
    });

    await auditLog({
      actorId: guard.user.id,
      action: "PASSKEY_RESET",
      entityType: "Employee",
      entityId: id,
      metadata: { employeeId: employee.employeeId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
