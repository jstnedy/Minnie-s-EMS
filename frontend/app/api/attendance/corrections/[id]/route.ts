import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";
import { attendanceCorrectionReviewSchema } from "@/lib/validators";
import { auditLog } from "@/lib/audit";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN]);
  if ("error" in guard) return guard.error;

  try {
    const { id } = await context.params;
    const parsed = attendanceCorrectionReviewSchema.parse(await req.json());

    const request = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id },
    });

    if (!request) return NextResponse.json({ error: "Correction request not found" }, { status: 404 });
    if (request.status !== "PENDING") {
      return NextResponse.json({ error: "Correction request already reviewed" }, { status: 409 });
    }

    if (parsed.action === "approve") {
      await prisma.$transaction([
        prisma.attendanceLog.update({
          where: { id: request.attendanceLogId },
          data: {
            timeIn: request.requestedTimeIn,
            timeOut: request.requestedTimeOut,
            editedBy: guard.user.id,
            editedAt: new Date(),
            editReason: request.reason,
          },
        }),
        prisma.attendanceCorrectionRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedBy: guard.user.id,
            reviewedAt: new Date(),
            reviewNotes: parsed.reviewNotes?.trim() || null,
          },
        }),
      ]);

      await auditLog({
        actorId: guard.user.id,
        action: "ATTENDANCE_CORRECTION_APPROVED",
        entityType: "AttendanceCorrectionRequest",
        entityId: id,
        metadata: { reviewNotes: parsed.reviewNotes ?? null },
      });

      return NextResponse.json({ ok: true, status: "APPROVED" });
    }

    await prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedBy: guard.user.id,
        reviewedAt: new Date(),
        reviewNotes: parsed.reviewNotes?.trim() || null,
      },
    });

    await auditLog({
      actorId: guard.user.id,
      action: "ATTENDANCE_CORRECTION_REJECTED",
      entityType: "AttendanceCorrectionRequest",
      entityId: id,
      metadata: { reviewNotes: parsed.reviewNotes ?? null },
    });

    return NextResponse.json({ ok: true, status: "REJECTED" });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
