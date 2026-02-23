import { getServerSession } from "next-auth";
import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";
import { roleCreateSchema } from "@/lib/validators";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const canManageRoles = ([UserRole.ADMIN, UserRole.SUPERVISOR] as UserRole[]).includes(session.user.role as UserRole);
  const includeInactive = searchParams.get("includeInactive") === "true" && canManageRoles;

  const roles = await prisma.role.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ roles, canManageRoles });
}

export async function POST(req: Request) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  try {
    const parsed = roleCreateSchema.parse(await req.json());
    const normalized = parsed.name.trim();

    const existing = await prisma.role.findFirst({
      where: { name: { equals: normalized, mode: "insensitive" } },
    });

    if (existing) {
      return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }

    const role = await prisma.role.create({
      data: {
        name: normalized,
        isActive: true,
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
