import { Prisma, PrismaClient } from "@prisma/client";
import { monthRange } from "@/lib/utils";

export async function computePayrollRun(
  prisma: PrismaClient,
  month: number,
  year: number,
  runId: string,
  employeeCode?: string,
) {
  const { start, end } = monthRange(year, month);
  let employeePk: string | undefined;

  if (employeeCode) {
    const employee = await prisma.employee.findUnique({
      where: { employeeId: employeeCode },
      select: { id: true },
    });
    if (!employee) {
      return;
    }
    employeePk = employee.id;
  }

  const employees = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      ...(employeePk ? { id: employeePk } : {}),
    },
    include: {
      attendanceLogs: {
        where: {
          timeIn: { gte: start, lt: end },
          NOT: { timeOut: null },
        },
      },
    },
  });

  for (const employee of employees) {
    let totalMs = 0;
    for (const log of employee.attendanceLogs) {
      if (!log.timeOut) continue;
      const diff = new Date(log.timeOut).getTime() - new Date(log.timeIn).getTime();
      if (diff > 0) totalMs += diff;
    }

    const totalHours = Number((totalMs / (1000 * 60 * 60)).toFixed(2));
    const basePay = Number((totalHours * Number(employee.hourlyRate)).toFixed(2));

    await prisma.payrollItem.upsert({
      where: {
        payrollRunId_employeeId: {
          payrollRunId: runId,
          employeeId: employee.id,
        },
      },
      update: {
        totalHours: new Prisma.Decimal(totalHours),
        totalShifts: employee.attendanceLogs.length,
        basePay: new Prisma.Decimal(basePay),
        adjustmentsTotal: new Prisma.Decimal(0),
        netPay: new Prisma.Decimal(basePay),
      },
      create: {
        payrollRunId: runId,
        employeeId: employee.id,
        totalHours: new Prisma.Decimal(totalHours),
        totalShifts: employee.attendanceLogs.length,
        basePay: new Prisma.Decimal(basePay),
        adjustmentsTotal: new Prisma.Decimal(0),
        netPay: new Prisma.Decimal(basePay),
      },
    });
  }

  const adjustments = await prisma.payrollAdjustment.findMany({
    where: {
      payrollRunId: runId,
      ...(employeePk ? { employeeId: employeePk } : {}),
    },
  });

  for (const adj of adjustments) {
    const item = await prisma.payrollItem.findUnique({
      where: {
        payrollRunId_employeeId: {
          payrollRunId: runId,
          employeeId: adj.employeeId,
        },
      },
    });

    if (!item) continue;

    const adjustmentsTotal = Number(item.adjustmentsTotal) + Number(adj.amount);
    const netPay = Number(item.basePay) + adjustmentsTotal;

    await prisma.payrollItem.update({
      where: { id: item.id },
      data: {
        adjustmentsTotal: new Prisma.Decimal(adjustmentsTotal.toFixed(2)),
        netPay: new Prisma.Decimal(netPay.toFixed(2)),
      },
    });
  }
}
