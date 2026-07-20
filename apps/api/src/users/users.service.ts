import { createHash, randomBytes } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import type { RequestMetadata } from '../auth/auth.types';
import { NotificationService } from '../auth/notification.service';
import { PasswordService } from '../auth/password.service';
import { pageMeta } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';
import { serializableTransaction } from '../database/transaction';
import { Prisma, Role } from '../generated/prisma/client';

import type { CreateUserDto, UpdateUserDto, UserListQueryDto } from './users.dto';

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async list(query: UserListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: { name: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }

  async assignees() {
    return this.prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(input: CreateUserDto, actorId: string, metadata: RequestMetadata) {
    const email = input.email.trim().toLocaleLowerCase('en-US');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new ConflictException({
        code: 'USER_EMAIL_EXISTS',
        message: 'That email is already in use.',
      });
    let passwordHash: string | undefined;
    if (input.password) {
      this.passwords.validate(input.password, email);
      passwordHash = await this.passwords.hash(input.password);
    }
    const invitationToken = passwordHash ? undefined : randomBytes(32).toString('base64url');
    const user = await this.prisma.$transaction(async (database) => {
      const created = await database.user.create({
        data: {
          name: input.name.trim(),
          email,
          role: input.role,
          ...(passwordHash ? { passwordHash } : {}),
        },
        select: safeUserSelect,
      });
      if (invitationToken) {
        await database.invitationToken.create({
          data: {
            userId: created.id,
            createdById: actorId,
            tokenHash: createHash('sha256').update(invitationToken).digest('hex'),
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      }
      await this.audit.record(
        {
          actorId,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: created.id,
          requestId: metadata.requestId,
          after: {
            name: created.name,
            email: created.email,
            role: created.role,
            isActive: created.isActive,
          },
        },
        database,
      );
      return created;
    });
    if (invitationToken) await this.notifications.sendInvitation(user.email, invitationToken);
    return user;
  }

  async update(id: string, input: UpdateUserDto, actorId: string, metadata: RequestMetadata) {
    if (id === actorId && input.isActive === false) {
      throw new ConflictException({
        code: 'SELF_DEACTIVATION_FORBIDDEN',
        message: 'You cannot deactivate your current account.',
      });
    }
    return this.prisma.$transaction(async (database) => {
      const current = await database.user.findFirst({ where: { id, deletedAt: null } });
      if (!current)
        throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found.' });
      const removesAdmin =
        current.role === Role.ADMIN &&
        ((input.role !== undefined && input.role !== Role.ADMIN) || input.isActive === false);
      if (removesAdmin && current.isActive) {
        const adminCount = await database.user.count({
          where: { role: Role.ADMIN, isActive: true, deletedAt: null },
        });
        if (adminCount <= 1)
          throw new ConflictException({
            code: 'LAST_ADMIN_REQUIRED',
            message: 'At least one active administrator is required.',
          });
      }
      const email = input.email?.trim().toLocaleLowerCase('en-US');
      const updated = await database.user.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(email ? { email } : {}),
          ...(input.role ? { role: input.role } : {}),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
        select: safeUserSelect,
      });
      const sessionSensitive =
        (input.role !== undefined && input.role !== current.role) ||
        (email !== undefined && email !== current.email) ||
        input.isActive === false;
      if (sessionSensitive) {
        await database.refreshSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.record(
        {
          actorId,
          action:
            input.isActive === false
              ? 'USER_DEACTIVATED'
              : input.isActive
                ? 'USER_ACTIVATED'
                : 'USER_UPDATED',
          entityType: 'User',
          entityId: id,
          requestId: metadata.requestId,
          before: {
            name: current.name,
            email: current.email,
            role: current.role,
            isActive: current.isActive,
          },
          after: {
            name: updated.name,
            email: updated.email,
            role: updated.role,
            isActive: updated.isActive,
          },
        },
        database,
      );
      return updated;
    }, serializableTransaction);
  }
}
