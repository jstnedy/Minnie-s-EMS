import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export async function DashboardShell({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: UserRole[];
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!roles.includes(session.user.role)) redirect("/me");

  return (
    <main>
      <AppNav role={session.user.role} />
      <div className="mx-auto max-w-6xl p-4">{children}</div>
    </main>
  );
}
