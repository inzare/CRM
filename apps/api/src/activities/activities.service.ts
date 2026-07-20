import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import type { RequestMetadata } from '../auth/auth.types';
import { canManageAllRecords, type AuthenticatedActor } from '../common/authorization-scope';
import { pageMeta } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';
import { ActivityType, Prisma, TaskStatus } from '../generated/prisma/client';

import { TaskListQueryDto, type ActivityDto, type TaskDto } from './activities.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async createActivity(input: ActivityDto, actor: AuthenticatedActor, metadata: RequestMetadata) {
    this.oneParent(input);
    await this.parentAccess(input, actor);
    return this.prisma.$transaction(async (db) => {
      const created = await db.activity.create({
        data: {
          type: input.type,
          subject: input.subject.trim(),
          body: input.body?.trim() ?? null,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          companyId: input.companyId ?? null,
          contactId: input.contactId ?? null,
          leadId: input.leadId ?? null,
          opportunityId: input.opportunityId ?? null,
          creatorId: actor.id,
        },
        include: { creator: { select: { id: true, name: true } } },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'ACTIVITY_CREATED',
          entityType: 'Activity',
          entityId: created.id,
          requestId: metadata.requestId,
          after: { type: created.type, subject: created.subject },
        },
        db,
      );
      return created;
    });
  }
  async listActivities(query: TaskListQueryDto, actor: AuthenticatedActor) {
    const where: Prisma.ActivityWhereInput = {
      deletedAt: null,
      ...(canManageAllRecords(actor) ? {} : { creatorId: actor.id }),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' } },
              { body: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          lead: { select: { id: true, companyName: true } },
          opportunity: { select: { id: true, name: true } },
        },
        orderBy: { occurredAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.activity.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }
  async deleteActivity(
    id: string,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    const current = await this.prisma.activity.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(canManageAllRecords(actor) ? {} : { creatorId: actor.id }),
      },
    });
    if (!current) throw this.notFound('Activity');
    await this.prisma.$transaction(async (db) => {
      await db.activity.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'ACTIVITY_DELETED',
          entityType: 'Activity',
          entityId: id,
          requestId: metadata.requestId,
          before: { type: current.type, subject: current.subject },
        },
        db,
      );
    });
  }
  async createTask(input: TaskDto, actor: AuthenticatedActor, metadata: RequestMetadata) {
    this.oneParent(input);
    await this.parentAccess(input, actor);
    const assignee = await this.prisma.user.findFirst({
      where: { id: input.assigneeId, isActive: true, deletedAt: null },
    });
    if (!assignee)
      throw new BadRequestException({
        code: 'INVALID_ASSIGNEE',
        message: 'Choose an active assignee.',
      });
    return this.prisma.$transaction(async (db) => {
      const activity = await db.activity.create({
        data: {
          type: ActivityType.TASK,
          subject: input.subject.trim(),
          body: input.description?.trim() ?? null,
          occurredAt: new Date(),
          creatorId: actor.id,
          companyId: input.companyId ?? null,
          contactId: input.contactId ?? null,
          leadId: input.leadId ?? null,
          opportunityId: input.opportunityId ?? null,
        },
      });
      const task = await db.task.create({
        data: {
          activityId: activity.id,
          subject: input.subject.trim(),
          description: input.description?.trim() ?? null,
          priority: input.priority ?? 'MEDIUM',
          dueAt: new Date(input.dueAt),
          assigneeId: input.assigneeId,
          creatorId: actor.id,
          companyId: input.companyId ?? null,
          contactId: input.contactId ?? null,
          leadId: input.leadId ?? null,
          opportunityId: input.opportunityId ?? null,
        },
        include: this.taskInclude(),
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'TASK_CREATED',
          entityType: 'Task',
          entityId: task.id,
          requestId: metadata.requestId,
          after: { assigneeId: task.assigneeId, dueAt: task.dueAt.toISOString() },
        },
        db,
      );
      return task;
    });
  }
  async tasks(query: TaskListQueryDto, actor: AuthenticatedActor) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(canManageAllRecords(actor) && query.assigneeId
        ? { assigneeId: query.assigneeId }
        : canManageAllRecords(actor)
          ? {}
          : { assigneeId: actor.id }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.view === 'today'
        ? { dueAt: { gte: start, lt: end } }
        : query.view === 'overdue'
          ? { dueAt: { lt: now }, status: TaskStatus.OPEN }
          : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: this.taskInclude(),
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }
  async complete(
    id: string,
    actor: AuthenticatedActor,
    reopen: boolean,
    metadata: RequestMetadata,
  ) {
    const current = await this.prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw this.notFound('Task');
    if (
      !canManageAllRecords(actor) &&
      current.assigneeId !== actor.id &&
      current.creatorId !== actor.id
    )
      throw new ForbiddenException({
        code: 'TASK_ACCESS_DENIED',
        message: 'You cannot update this task.',
      });
    const target = reopen ? TaskStatus.OPEN : TaskStatus.COMPLETED;
    if (current.status === target)
      return this.prisma.task.findUniqueOrThrow({ where: { id }, include: this.taskInclude() });
    return this.prisma.$transaction(async (db) => {
      const updated = await db.task.update({
        where: { id },
        data: {
          status: target,
          completedAt: reopen ? null : new Date(),
          completedById: reopen ? null : actor.id,
        },
        include: this.taskInclude(),
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: reopen ? 'TASK_REOPENED' : 'TASK_COMPLETED',
          entityType: 'Task',
          entityId: id,
          requestId: metadata.requestId,
          before: { status: current.status },
          after: { status: updated.status },
        },
        db,
      );
      return updated;
    });
  }
  async widgets(actor: AuthenticatedActor) {
    const today = await this.tasks(
      Object.assign(new TaskListQueryDto(), { view: 'today', pageSize: 10 }),
      actor,
    );
    const overdue = await this.tasks(
      Object.assign(new TaskListQueryDto(), { view: 'overdue', pageSize: 10 }),
      actor,
    );
    const threshold = new Date(Date.now() - 14 * 86400000);
    const companies = await this.prisma.company.findMany({
      where: {
        deletedAt: null,
        ...(canManageAllRecords(actor) ? {} : { ownerId: actor.id }),
        activities: { none: { deletedAt: null, occurredAt: { gte: threshold } } },
      },
      select: { id: true, name: true, owner: { select: { id: true, name: true } } },
      take: 10,
      orderBy: { updatedAt: 'asc' },
    });
    return {
      today: today.data,
      overdue: overdue.data,
      noRecentActivity: companies,
      thresholdDays: 14,
    };
  }
  private oneParent(input: {
    companyId?: string;
    contactId?: string;
    leadId?: string;
    opportunityId?: string;
  }) {
    if (
      [input.companyId, input.contactId, input.leadId, input.opportunityId].filter(Boolean)
        .length !== 1
    )
      throw new BadRequestException({
        code: 'EXACTLY_ONE_PARENT_REQUIRED',
        message: 'Choose exactly one linked CRM record.',
      });
  }
  private async parentAccess(
    input: { companyId?: string; contactId?: string; leadId?: string; opportunityId?: string },
    actor: AuthenticatedActor,
  ) {
    const owner = canManageAllRecords(actor) ? {} : { ownerId: actor.id };
    const exists = input.companyId
      ? await this.prisma.company.findFirst({
          where: { id: input.companyId, deletedAt: null, ...owner },
        })
      : input.contactId
        ? await this.prisma.contact.findFirst({
            where: { id: input.contactId, deletedAt: null, ...owner },
          })
        : input.leadId
          ? await this.prisma.lead.findFirst({
              where: { id: input.leadId, deletedAt: null, ...owner },
            })
          : await this.prisma.opportunity.findFirst({
              where: { id: input.opportunityId!, deletedAt: null, ...owner },
            });
    if (!exists) throw this.notFound('Linked record');
  }
  private taskInclude() {
    return {
      assignee: { select: { id: true, name: true, role: true } },
      creator: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      lead: { select: { id: true, companyName: true } },
      opportunity: { select: { id: true, name: true } },
    } as const;
  }
  private notFound(entity: string) {
    return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: `${entity} not found.` });
  }
}
