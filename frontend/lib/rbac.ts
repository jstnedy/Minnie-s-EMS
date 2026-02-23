import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export type SessionUser = {
  id: string;
  role: UserRole;
  email?: string | null;
};

export async function requireApiRole(allowed: UserRole[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = session.user as SessionUser;
  if (!allowed.includes(user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export function canAssignRole(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === UserRole.ADMIN) return true;
  if (actorRole === UserRole.SUPERVISOR) {
    return targetRole !== UserRole.ADMIN;
  }
  return false;
}
