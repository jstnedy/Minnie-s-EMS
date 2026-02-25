export const dynamic = "force-dynamic";
import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { AttendanceClient } from "@/components/attendance-client";
import { authOptions } from "@/lib/auth";

export default async function AttendancePage() {
  const session = await getServerSession(authOptions);
  const canDelete = session?.user.role === UserRole.ADMIN;
  const canEdit = session?.user.role === UserRole.ADMIN || session?.user.role === UserRole.SUPERVISOR;
  const canReviewCorrections = session?.user.role === UserRole.ADMIN;

  return (
    <DashboardShell roles={[UserRole.ADMIN, UserRole.SUPERVISOR]}>
      <h1 className="mb-4 text-2xl font-bold">Attendance</h1>
      <AttendanceClient canDelete={Boolean(canDelete)} canEdit={Boolean(canEdit)} canReviewCorrections={Boolean(canReviewCorrections)} />
    </DashboardShell>
  );
}

