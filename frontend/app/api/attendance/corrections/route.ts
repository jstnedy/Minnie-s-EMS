import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";

export async function GET() {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  const where =
    guard.user.role === UserRole.ADMIN
      ? { status: "PENDING" as const }
      : { requestedBy: guard.user.id, status: "PENDING" as const };

  const rows = await prisma.attendanceCorrectionRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      attendanceLog: {
        select: {
          id: true,
          timeIn: true,
          timeOut: true,
          employee: {
            select: { employeeId: true, firstName: true, lastName: true },
          },
        },
      },
      requester: { select: { id: true, email: true, role: true } },
    },
  });

  return NextResponse.json(rows);
}
