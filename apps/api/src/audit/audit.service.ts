import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { Prisma, type PrismaClient } from '../generated/prisma/client';

type AuditDatabase = Pick<PrismaClient, 'auditLog'> | Prisma.TransactionClient;

export interface AuditEventInput {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditEventInput, database: AuditDatabase = this.prisma): Promise<void> {
    await database.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        requestId: input.requestId,
        ...(input.actorId ? { actorId: input.actorId } : {}),
        ...(input.entityId ? { entityId: input.entityId } : {}),
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent.slice(0, 512) } : {}),
        ...(input.before ? { before: input.before } : {}),
        ...(input.after ? { after: input.after } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });
  }
}
