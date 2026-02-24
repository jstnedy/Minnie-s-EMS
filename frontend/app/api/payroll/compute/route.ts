import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";
import { payrollComputeBodySchema, payrollComputeSchema } from "@/lib/validators";
import { computePayrollRun } from "@/lib/payroll";

export async function POST(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId")?.trim() ?? "";
    const parsed = payrollComputeSchema.parse({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
    });

    const bodyJson = await req.json().catch(() => ({}));
    const body = payrollComputeBodySchema.parse(bodyJson);

    const existingFinal = await prisma.payrollRun.findFirst({
      where: { month: parsed.month, year: parsed.year, status: "FINAL" },
    });

    if (existingFinal) {
      return NextResponse.json({ error: "Payroll already finalized for this period" }, { status: 409 });
    }

    const run = await prisma.payrollRun.upsert({
      where: {
        month_year_status: {
          month: parsed.month,
          year: parsed.year,
          status: "DRAFT",
        },
      },
      update: {},
      create: {
        month: parsed.month,
        year: parsed.year,
        status: "DRAFT",
        createdBy: guard.user.id,
      },
    });

    if (body.adjustments.length > 0) {
      await prisma.payrollAdjustment.createMany({
        data: body.adjustments.map((a) => ({
          payrollRunId: run.id,
          employeeId: a.employeeId,
          amount: a.amount,
          reason: a.reason,
          createdBy: guard.user.id,
        })),
      });
    }

    await computePayrollRun(prisma, parsed.month, parsed.year, run.id, employeeId || undefined);

    const items = await prisma.payrollItem.findMany({
      where: {
        payrollRunId: run.id,
        ...(employeeId ? { employee: { employeeId } } : {}),
      },
      include: { employee: true },
      orderBy: { employee: { employeeId: "asc" } },
    });

    return NextResponse.json({ run, items });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
