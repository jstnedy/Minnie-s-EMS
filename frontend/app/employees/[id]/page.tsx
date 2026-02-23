export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmployeeDetailClient } from "@/components/employee-detail-client";
import { prisma } from "@/lib/prisma";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { role: true, attendanceLogs: { orderBy: { timeIn: "desc" }, take: 30 } },
  });

  if (!employee) notFound();

  const safeEmployee = {
    ...employee,
    hourlyRate: employee.hourlyRate.toString(),
    attendanceLogs: employee.attendanceLogs.map((l) => ({
      id: l.id,
      timeIn: l.timeIn.toISOString(),
      timeOut: l.timeOut ? l.timeOut.toISOString() : null,
      source: l.source,
    })),
  };

  return (
    <DashboardShell roles={[UserRole.ADMIN, UserRole.SUPERVISOR]}>
      <h1 className="mb-4 text-2xl font-bold">Employee Detail</h1>
      <EmployeeDetailClient employee={safeEmployee} appBaseUrl={process.env.APP_BASE_URL || "http://localhost:3000"} />
    </DashboardShell>
  );
}

