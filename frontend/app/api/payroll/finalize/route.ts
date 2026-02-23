import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";
import { payrollFinalizeSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN]);
  if ("error" in guard) return guard.error;

  try {
    const parsed = payrollFinalizeSchema.parse(await req.json());

    const run = await prisma.payrollRun.findUnique({
      where: { id: parsed.payrollRunId },
    });

    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    if (run.status === "FINAL") return NextResponse.json({ error: "Already finalized" }, { status: 409 });

    const finalized = await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: "FINAL" },
    });

    return NextResponse.json(finalized);
  } catch (error) {
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
