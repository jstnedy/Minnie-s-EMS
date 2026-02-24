import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const logs = await prisma.attendanceLog.findMany({
      where: {
        employeeId: employeeId
          ? {
              in: (
                await prisma.employee.findMany({
                  where: { employeeId },
                  select: { id: true },
                })
              ).map((e) => e.id),
            }
          : undefined,
        timeIn:
          start || end
            ? {
                gte: start ? new Date(start) : undefined,
                lte: end ? new Date(end) : undefined,
            }
          : undefined,
      },
      orderBy: { timeIn: "desc" },
      select: {
        id: true,
        employeeId: true,
        timeIn: true,
        timeOut: true,
        source: true,
        deviceInfo: true,
        editedBy: true,
        editedAt: true,
        editReason: true,
        createdAt: true,
        updatedAt: true,
        timeInPhoto: true,
        timeOutPhoto: true,
      },
    });

    const employeeIds = Array.from(new Set(logs.map((log) => log.employeeId)));
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
      },
    });
    const employeeById = new Map(employees.map((e) => [e.id, e]));

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
        employee:
          employeeById.get(log.employeeId) ?? {
            employeeId: "DELETED",
            firstName: "Deleted",
            lastName: "Employee",
          },
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ error: "Unable to load attendance logs", detail: String(error) }, { status: 500 });
  }
}
