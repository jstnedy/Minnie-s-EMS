export const dynamic = "force-dynamic";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { AttendanceClient } from "@/components/attendance-client";

export default function AttendancePage() {
  return (
    <DashboardShell roles={[UserRole.ADMIN, UserRole.SUPERVISOR]}>
      <h1 className="mb-4 text-2xl font-bold">Attendance</h1>
      <AttendanceClient />
    </DashboardShell>
  );
}

