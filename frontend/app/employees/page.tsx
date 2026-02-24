export const dynamic = "force-dynamic";
import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmployeesClient } from "@/components/employees-client";
import { authOptions } from "@/lib/auth";

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions);
  const canDelete = session?.user.role === UserRole.ADMIN;

  return (
    <DashboardShell roles={[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE]}>
      <h1 className="mb-4 text-2xl font-bold">Employees</h1>
      <EmployeesClient canDelete={Boolean(canDelete)} />
    </DashboardShell>
  );
}

