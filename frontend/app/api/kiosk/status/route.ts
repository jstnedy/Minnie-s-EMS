import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId")?.trim() ?? "";

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { employeeId },
    select: { id: true, firstName: true, lastName: true, status: true, employeeId: true },
  });

  if (!employee || employee.status !== "ACTIVE") {
    return NextResponse.json({ error: "Employee unavailable" }, { status: 404 });
  }

  const openShift = await prisma.attendanceLog.findFirst({
    where: { employeeId: employee.id, timeOut: null },
    orderBy: { timeIn: "desc" },
    select: { id: true, timeIn: true },
  });

  return NextResponse.json({
    employee: {
      employeeId: employee.employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
    },
    isTimedIn: Boolean(openShift),
    openShiftTimeIn: openShift?.timeIn.toISOString() ?? null,
  });
}
