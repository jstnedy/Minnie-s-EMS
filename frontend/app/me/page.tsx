export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
    include: {
      attendanceLogs: { orderBy: { timeIn: "desc" }, take: 20 },
      payrollItems: {
        include: { payrollRun: true },
        orderBy: { payrollRun: { createdAt: "desc" } },
        take: 12,
      },
    },
  });

  if (!employee && session.user.role === UserRole.EMPLOYEE) {
    return (
      <DashboardShell roles={[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE]}>
        <p className="card">Your account is active but not linked to an employee profile yet.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell roles={[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE]}>
      <h1 className="mb-4 text-2xl font-bold">My Records</h1>
      {employee ? (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold">Attendance</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2">Time In</th>
                    <th className="py-2">Time Out</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.attendanceLogs.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100">
                      <td className="py-2">{new Date(l.timeIn).toLocaleString()}</td>
                      <td className="py-2">{l.timeOut ? new Date(l.timeOut).toLocaleString() : "Open"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold">Payslips</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2">Period</th>
                    <th className="py-2">Hours</th>
                    <th className="py-2">Net Pay</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.payrollItems.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2">{p.payrollRun.month}/{p.payrollRun.year}</td>
                      <td className="py-2">{String(p.totalHours)}</td>
                      <td className="py-2">${Number(p.netPay).toFixed(2)}</td>
                      <td className="py-2">{p.payrollRun.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <p className="card">No linked employee profile.</p>
      )}
    </DashboardShell>
  );
}

