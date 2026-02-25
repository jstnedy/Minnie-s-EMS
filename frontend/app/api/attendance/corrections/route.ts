import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";

export async function GET() {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  try {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
      return NextResponse.json(
        { error: "Corrections feature is not available yet. Database migration is still pending." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Unable to load correction requests", detail: String(error) }, { status: 500 });
  }
}
