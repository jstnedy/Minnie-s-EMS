import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getEmployeeBySessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return prisma.employee.findFirst({
    where: { userId: session.user.id },
  });
}

export function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
}
