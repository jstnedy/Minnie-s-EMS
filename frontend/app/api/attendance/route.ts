import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const logs = await prisma.attendanceLog.findMany({
    where: {
      employee: employeeId ? { employeeId } : undefined,
      timeIn:
        start || end
          ? {
              gte: start ? new Date(start) : undefined,
              lte: end ? new Date(end) : undefined,
            }
          : undefined,
    },
    include: { employee: true },
    orderBy: { timeIn: "desc" },
  });

  return NextResponse.json(
    logs.map((log) => ({
      id: log.id,
      employeeId: log.employeeId,
      timeIn: log.timeIn,
      timeOut: log.timeOut,
      source: log.source,
      deviceInfo: log.deviceInfo,
      editedBy: log.editedBy,
      editedAt: log.editedAt,
      editReason: log.editReason,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
      hasTimeInPhoto: Boolean(log.timeInPhoto),
      hasTimeOutPhoto: Boolean(log.timeOutPhoto),
      employee: log.employee,
    })),
  );
}
