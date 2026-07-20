import { Injectable } from '@nestjs/common';

import { canManageAllRecords, type AuthenticatedActor } from '../common/authorization-scope';
import { PrismaService } from '../database/prisma.service';
import { Prisma, StageType, TaskStatus } from '../generated/prisma/client';

import { csvDocument } from './csv';
import type { ReportQueryDto } from './reporting.dto';

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}
  async dashboard(query: ReportQueryDto, actor: AuthenticatedActor) {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);
    const scope = this.scope(query, actor);
    const taskScope =
      canManageAllRecords(actor) && query.ownerId
        ? { assigneeId: query.ownerId }
        : canManageAllRecords(actor)
          ? {}
          : { assigneeId: actor.id };
    const [today, overdue, noRecentActivity, renewals] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          status: TaskStatus.OPEN,
          ...taskScope,
          dueAt: { gte: startToday, lt: endToday },
        },
        include: {
          company: { select: { id: true, name: true } },
          opportunity: { select: { id: true, name: true } },
        },
        orderBy: { dueAt: 'asc' },
        take: 10,
      }),
      this.prisma.task.findMany({
        where: { deletedAt: null, status: TaskStatus.OPEN, ...taskScope, dueAt: { lt: now } },
        include: {
          company: { select: { id: true, name: true } },
          opportunity: { select: { id: true, name: true } },
        },
        orderBy: { dueAt: 'asc' },
        take: 10,
      }),
      this.prisma.company.findMany({
        where: {
          deletedAt: null,
          ...(canManageAllRecords(actor) ? {} : { ownerId: actor.id }),
          activities: {
            none: { deletedAt: null, occurredAt: { gte: new Date(Date.now() - 14 * 86400000) } },
          },
        },
        select: { id: true, name: true, owner: { select: { name: true } } },
        take: 10,
      }),
      this.prisma.contract.findMany({
        where: {
          deletedAt: null,
          ...scope,
          renewalDate: { gte: now, lte: new Date(Date.now() + 90 * 86400000) },
        },
        include: { opportunity: { include: { company: true } }, owner: { select: { name: true } } },
        orderBy: { renewalDate: 'asc' },
        take: 10,
      }),
    ]);
    if (actor.role === 'CONSULTANT')
      return { sales: null, today, overdue, noRecentActivity, renewals: [] };
    const opportunities = await this.prisma.opportunity.findMany({
      where: { deletedAt: null, ...scope, ...this.dateScope(query, 'closeDate') },
      include: { stage: true, items: { include: { catalogItem: true } } },
    });
    const stages = await this.prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } });
    const pipeline = stages.map((stage) => {
      const matching = opportunities.filter((item) => item.stageId === stage.id);
      return {
        stageId: stage.id,
        key: stage.key,
        name: stage.displayName,
        type: stage.type,
        count: matching.length,
        value: matching
          .reduce((sum, item) => sum.add(item.expectedValue), new Prisma.Decimal(0))
          .toString(),
        weighted: matching
          .reduce(
            (sum, item) => sum.add(item.expectedValue.mul(item.probability).div(100)),
            new Prisma.Decimal(0),
          )
          .toString(),
      };
    });
    const won = opportunities.filter((item) => item.stage.type === StageType.WON);
    const lost = opportunities.filter((item) => item.stage.type === StageType.LOST);
    const leads = await this.prisma.lead.count({
      where: { deletedAt: null, ...scope, ...this.dateScope(query, 'createdAt') },
    });
    const converted = await this.prisma.lead.count({
      where: {
        deletedAt: null,
        ...scope,
        status: 'CONVERTED',
        ...this.dateScope(query, 'createdAt'),
      },
    });
    const acceptedLines = await this.prisma.quoteLine.findMany({
      where: {
        quote: {
          status: 'ACCEPTED',
          opportunity: { deletedAt: null, ...scope, ...this.dateScope(query, 'actualCloseDate') },
        },
      },
    });
    const salesMap = new Map<string, Prisma.Decimal>();
    for (const line of acceptedLines)
      salesMap.set(line.sku, (salesMap.get(line.sku) ?? new Prisma.Decimal(0)).add(line.total));
    return {
      sales: {
        pipeline,
        weightedForecast: pipeline
          .reduce((sum, item) => sum.add(item.weighted), new Prisma.Decimal(0))
          .toString(),
        wonRevenue: won
          .reduce((sum, item) => sum.add(item.expectedValue), new Prisma.Decimal(0))
          .toString(),
        leadConversionRate: leads ? converted / leads : 0,
        winRate: won.length + lost.length ? won.length / (won.length + lost.length) : 0,
        wonCount: won.length,
        lostCount: lost.length,
        salesByOffering: [...salesMap].map(([sku, value]) => ({ sku, value: value.toString() })),
        currency: query.currency?.toUpperCase() ?? 'USD',
      },
      today,
      overdue,
      noRecentActivity,
      renewals,
    };
  }
  async export(
    kind: 'opportunities' | 'offering-sales' | 'renewals' | 'overdue',
    query: ReportQueryDto,
    actor: AuthenticatedActor,
  ) {
    const scope = this.scope(query, actor);
    if (kind === 'opportunities') {
      const data = await this.prisma.opportunity.findMany({
        where: { deletedAt: null, ...scope, ...this.dateScope(query, 'closeDate') },
        include: { company: true, owner: true, stage: true },
        take: 10000,
        orderBy: { closeDate: 'asc' },
      });
      return csvDocument(
        [
          'Opportunity',
          'Company',
          'Owner',
          'Stage',
          'Expected value',
          'Currency',
          'Probability',
          'Close date',
        ],
        data.map((item) => [
          item.name,
          item.company.name,
          item.owner.name,
          item.stage.displayName,
          item.expectedValue,
          item.currency,
          item.probability,
          item.closeDate,
        ]),
      );
    }
    if (kind === 'offering-sales') {
      const data = await this.prisma.quoteLine.findMany({
        where: { quote: { status: 'ACCEPTED', opportunity: { deletedAt: null, ...scope } } },
        include: { quote: true },
        take: 10000,
      });
      return csvDocument(
        ['SKU', 'Description', 'Quantity', 'Unit price', 'Total', 'Currency'],
        data.map((item) => [
          item.sku,
          item.description,
          item.quantity,
          item.unitPrice,
          item.total,
          item.quote.currency,
        ]),
      );
    }
    if (kind === 'renewals') {
      const data = await this.prisma.contract.findMany({
        where: { deletedAt: null, ...scope, renewalDate: { not: null } },
        include: { opportunity: { include: { company: true } }, owner: true },
        take: 10000,
        orderBy: { renewalDate: 'asc' },
      });
      return csvDocument(
        ['Contract', 'Company', 'Owner', 'Amount', 'Currency', 'Status', 'Renewal date'],
        data.map((item) => [
          item.number,
          item.opportunity.company.name,
          item.owner.name,
          item.amount,
          item.currency,
          item.status,
          item.renewalDate,
        ]),
      );
    }
    const taskScope =
      canManageAllRecords(actor) && query.ownerId
        ? { assigneeId: query.ownerId }
        : canManageAllRecords(actor)
          ? {}
          : { assigneeId: actor.id };
    const data = await this.prisma.task.findMany({
      where: { deletedAt: null, status: 'OPEN', dueAt: { lt: new Date() }, ...taskScope },
      include: { assignee: true, company: true, opportunity: true },
      take: 10000,
      orderBy: { dueAt: 'asc' },
    });
    return csvDocument(
      ['Task', 'Assignee', 'Linked record', 'Due', 'Priority'],
      data.map((item) => [
        item.subject,
        item.assignee.name,
        item.company?.name ?? item.opportunity?.name ?? '',
        item.dueAt,
        item.priority,
      ]),
    );
  }
  private scope(query: ReportQueryDto, actor: AuthenticatedActor) {
    return canManageAllRecords(actor) && query.ownerId
      ? { ownerId: query.ownerId }
      : canManageAllRecords(actor)
        ? {}
        : { ownerId: actor.id };
  }
  private dateScope(query: ReportQueryDto, field: string) {
    if (!query.from && !query.to) return {};
    return {
      [field]: {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      },
    };
  }
}
