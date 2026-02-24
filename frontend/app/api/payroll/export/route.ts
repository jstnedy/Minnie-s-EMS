import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";
import { payrollComputeSchema } from "@/lib/validators";

export async function GET(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId")?.trim() ?? "";
    const parsed = payrollComputeSchema.parse({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
    });

    const run = await prisma.payrollRun.findFirst({
      where: { month: parsed.month, year: parsed.year },
      orderBy: { createdAt: "desc" },
    });

    if (!run) return NextResponse.json({ error: "No payroll run for selected period" }, { status: 404 });

    const items = await prisma.payrollItem.findMany({
      where: {
        payrollRunId: run.id,
        ...(employeeId ? { employee: { employeeId } } : {}),
      },
      include: { employee: true },
      orderBy: { employee: { employeeId: "asc" } },
    });

    const header = ["Employee ID", "Name", "Shifts", "Hours", "Base Pay", "Adjustments", "Net Pay"];
    const rows = items.map((i) => [
      i.employee.employeeId,
      `${i.employee.firstName} ${i.employee.lastName}`.trim(),
      String(i.totalShifts),
      String(i.totalHours),
      String(i.basePay),
      String(i.adjustmentsTotal),
      String(i.netPay),
    ]);

    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=payroll-${parsed.year}-${String(parsed.month).padStart(2, "0")}${employeeId ? `-${employeeId}` : ""}.csv`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
