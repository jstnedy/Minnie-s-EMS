import { Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/rbac";
import { roleUpdateSchema } from "@/lib/validators";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole([UserRole.ADMIN, UserRole.SUPERVISOR]);
  if ("error" in guard) return guard.error;

  try {
    const { id } = await context.params;
    const parsed = roleUpdateSchema.parse(await req.json());

    if (parsed.name) {
      const duplicate = await prisma.role.findFirst({
        where: {
          id: { not: id },
          name: { equals: parsed.name.trim(), mode: "insensitive" },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
      }
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        name: parsed.name?.trim(),
        isActive: parsed.isActive,
      },
    });

    return NextResponse.json(role);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Invalid request", detail: String(error) }, { status: 400 });
  }
}
