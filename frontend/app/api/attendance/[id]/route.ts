import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attendanceEditSchema } from "@/lib/validators";
import { auditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/rbac";

function decodeDataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) return null;
  const mimeType = m[1];
  const base64 = m[2];
  return { mimeType, bytes: Buffer.from(base64, "base64") };
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const photo = searchParams.get("photo");

  if (photo !== "timeIn" && photo !== "timeOut") {
    return NextResponse.json({ error: "photo query must be 'timeIn' or 'timeOut'" }, { status: 400 });
  }

  const log = await prisma.attendanceLog.findUnique({
    where: { id },
    select: { timeInPhoto: true, timeOutPhoto: true },
  });

  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = photo === "timeIn" ? log.timeInPhoto : log.timeOutPhoto;
  if (!raw) return NextResponse.json({ error: "No photo" }, { status: 404 });

  const decoded = decodeDataUrl(raw);
  if (!decoded) return NextResponse.json({ error: "Invalid photo data" }, { status: 400 });

  return new NextResponse(decoded.bytes, {
    headers: {
      "Content-Type": decoded.mimeType,
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  try {
    const parsed = attendanceEditSchema.parse(await req.json());

    const existing = await prisma.attendanceLog.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (guard.user.role === UserRole.SUPERVISOR) {
      const pending = await prisma.attendanceCorrectionRequest.findFirst({
        where: {
          attendanceLogId: id,
          status: "PENDING",
          requestedBy: guard.user.id,
        },
      });
      if (pending) {
        return NextResponse.json({ error: "You already have a pending correction request for this attendance record" }, { status: 409 });
      }

      const request = await prisma.attendanceCorrectionRequest.create({
        data: {
          attendanceLogId: id,
          requestedBy: guard.user.id,
          requestedTimeIn: new Date(parsed.timeIn),
          requestedTimeOut: parsed.timeOut ? new Date(parsed.timeOut) : null,
          reason: parsed.editReason,
          status: "PENDING",
        },
      });

      await auditLog({
        actorId: guard.user.id,
        action: "ATTENDANCE_CORRECTION_REQUESTED",
        entityType: "AttendanceCorrectionRequest",
        entityId: request.id,
        metadata: parsed,
      });

      return NextResponse.json(
        { ok: true, pendingApproval: true, message: "Correction submitted for admin approval", requestId: request.id },
        { status: 202 },
      );
    }

    const updated = await prisma.attendanceLog.update({
      where: { id },
      data: {
        timeIn: new Date(parsed.timeIn),
        timeOut: parsed.timeOut ? new Date(parsed.timeOut) : null,
        editedBy: guard.user.id,
        editedAt: new Date(),
        editReason: parsed.editReason,
      },
    });

    await auditLog({
      actorId: guard.user.id,
      action: "ATTENDANCE_EDIT",
      entityType: "AttendanceLog",
      entityId: id,
      metadata: parsed,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
      return NextResponse.json(
        { error: "Corrections feature is not available yet. Database migration is still pending." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN]);
  if ("error" in guard) return guard.error;

  const { id } = await context.params;
  const existing = await prisma.attendanceLog.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.attendanceLog.delete({ where: { id } });

  await auditLog({
    actorId: guard.user.id,
    action: "ATTENDANCE_DELETE",
    entityType: "AttendanceLog",
    entityId: id,
    metadata: {
      employeeId: existing.employeeId,
      timeIn: existing.timeIn.toISOString(),
      timeOut: existing.timeOut ? existing.timeOut.toISOString() : null,
    },
  });

  return NextResponse.json({ ok: true });
}
