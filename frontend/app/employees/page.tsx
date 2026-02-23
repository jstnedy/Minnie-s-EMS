export const dynamic = "force-dynamic";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmployeesClient } from "@/components/employees-client";

export default function EmployeesPage() {
  return (
    <DashboardShell roles={[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE]}>
      <h1 className="mb-4 text-2xl font-bold">Employees</h1>
      <EmployeesClient />
    </DashboardShell>
  );
}

