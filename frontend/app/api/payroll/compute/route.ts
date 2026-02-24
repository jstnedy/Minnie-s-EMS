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
      orderBy: { createdAt: "desc" },
    });

    if (existingFinal) {
      const finalizedItemsCount = await prisma.payrollItem.count({
        where: { payrollRunId: existingFinal.id },
      });

      // Recover from invalid empty FINAL runs caused by prior schema drift.
      if (finalizedItemsCount === 0) {
        await prisma.payrollAdjustment.deleteMany({
          where: { payrollRunId: existingFinal.id },
        });
        await prisma.payrollRun.delete({
          where: { id: existingFinal.id },
        });
      } else {
        return NextResponse.json(
          {
            error: "Payroll already finalized for this period",
            finalizedRunId: existingFinal.id,
            finalizedAt: existingFinal.createdAt.toISOString(),
          },
          { status: 409 },
        );
      }
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

    const targetEmployee = employeeId
      ? await prisma.employee.findUnique({ where: { employeeId }, select: { id: true } })
      : null;

    const itemsRaw = await prisma.payrollItem.findMany({
      where: {
        payrollRunId: run.id,
        ...(targetEmployee ? { employeeId: targetEmployee.id } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        totalShifts: true,
        totalHours: true,
        basePay: true,
        adjustmentsTotal: true,
        netPay: true,
      },
    });

    const employeeIds = Array.from(new Set(itemsRaw.map((item) => item.employeeId)));
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
      },
    });
    const employeeByPk = new Map(employees.map((e) => [e.id, e]));

    const items = itemsRaw
      .map((item) => ({
        ...item,
        employee:
          employeeByPk.get(item.employeeId) ?? {
            employeeId: "DELETED",
            firstName: "Deleted",
            lastName: "Employee",
          },
      }))
      .sort((a, b) => a.employee.employeeId.localeCompare(b.employee.employeeId, undefined, { numeric: true }));

    return NextResponse.json({ run, items });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
