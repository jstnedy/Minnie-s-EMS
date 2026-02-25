export const dynamic = "force-dynamic";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [activeEmployees, todayAttendance, pendingCorrections] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendanceLog.count({ where: { timeIn: { gte: todayStart } } }),
    prisma.attendanceCorrectionRequest.count({ where: { status: "PENDING" } }),
  ]);

  const cards = [
    { label: "Active Employees", value: activeEmployees },
    { label: "Today's Attendance", value: todayAttendance },
    { label: "Pending Corrections", value: pendingCorrections },
  ];

  return (
    <DashboardShell roles={[UserRole.ADMIN, UserRole.SUPERVISOR]}>
      <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-sm text-slate-600">{c.label}</p>
            <p className="text-3xl font-semibold text-orange-700">{c.value}</p>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}

