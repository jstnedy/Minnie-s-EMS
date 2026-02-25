export const dynamic = "force-dynamic";
import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const currentRole = session?.user.role as UserRole | undefined;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let pendingCorrections = 0;
  let pendingSupervisorCorrections: Array<{
    id: string;
    reason: string;
    createdAt: Date;
    attendanceLog: {
      employee: {
        employeeId: string;
        firstName: string;
        lastName: string;
      };
    };
    requester: { email: string };
  }> = [];

  try {
    const baseWhere = {
      status: "PENDING" as const,
      requester: { role: UserRole.SUPERVISOR },
    };
    pendingCorrections = await prisma.attendanceCorrectionRequest.count({ where: baseWhere });

    if (currentRole === UserRole.ADMIN) {
      pendingSupervisorCorrections = await prisma.attendanceCorrectionRequest.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          reason: true,
          createdAt: true,
          attendanceLog: {
            select: {
              employee: {
                select: { employeeId: true, firstName: true, lastName: true },
              },
            },
          },
          requester: {
            select: { email: true },
          },
        },
      });
    }
  } catch {
    // Fallback for environments where correction-request migration is not yet deployed.
    pendingCorrections = 0;
    pendingSupervisorCorrections = [];
  }

  const [activeEmployees, todayAttendance] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendanceLog.count({ where: { timeIn: { gte: todayStart } } }),
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
      {currentRole === UserRole.ADMIN ? (
        <div className="card mt-4 space-y-3">
          <h2 className="text-lg font-semibold">Pending Corrections From Supervisors</h2>
          {pendingSupervisorCorrections.length === 0 ? (
            <p className="text-sm text-slate-600">No pending supervisor corrections.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {pendingSupervisorCorrections.map((row) => (
                <Link
                  key={row.id}
                  href={`/attendance?correctionId=${encodeURIComponent(row.id)}`}
                  className="block rounded border border-slate-200 p-2 hover:border-orange-300 hover:bg-orange-50/40"
                >
                  <p className="font-medium">
                    {row.attendanceLog.employee.employeeId} - {`${row.attendanceLog.employee.firstName} ${row.attendanceLog.employee.lastName}`.trim()}
                  </p>
                  <p className="text-slate-600">Requested by: {row.requester.email}</p>
                  <p className="text-slate-600">Submitted: {new Date(row.createdAt).toLocaleString()}</p>
                  <p>Reason: {row.reason}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </DashboardShell>
  );
}

