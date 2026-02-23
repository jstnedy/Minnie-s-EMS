export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { PayrollClient } from "@/components/payroll-client";
import { authOptions } from "@/lib/auth";

export default async function PayrollPage() {
  const session = await getServerSession(authOptions);
  const canFinalize = session?.user.role === UserRole.ADMIN;

  return (
    <DashboardShell roles={[UserRole.ADMIN, UserRole.SUPERVISOR]}>
      <h1 className="mb-4 text-2xl font-bold">Payroll</h1>
      <PayrollClient canFinalize={Boolean(canFinalize)} />
    </DashboardShell>
  );
}

