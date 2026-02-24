import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";
import { payrollComputeSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN]);
  if ("error" in guard) return guard.error;

  try {
    const { searchParams } = new URL(req.url);
    const parsed = payrollComputeSchema.parse({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
    });

    const runs = await prisma.payrollRun.findMany({
      where: {
        month: parsed.month,
        year: parsed.year,
      },
      select: { id: true, status: true },
    });

    if (runs.length === 0) {
      return NextResponse.json({ error: "No payroll run found for selected period" }, { status: 404 });
    }

    const runIds = runs.map((r) => r.id);
    await prisma.payrollRun.deleteMany({
      where: { id: { in: runIds } },
    });

    return NextResponse.json({
      ok: true,
      deletedRuns: runs.length,
      deletedStatuses: Array.from(new Set(runs.map((r) => r.status))),
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
