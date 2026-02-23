import { prisma } from "@/lib/prisma";

export async function auditLog(params: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata as object | undefined,
    },
  });
}
