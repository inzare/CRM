import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { businessDayBounds } from '../activities/business-time';
import { canManageAllRecords, type AuthenticatedActor } from '../common/authorization-scope';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { Prisma, StageType, TaskStatus } from '../generated/prisma/client';

import { csvDocument } from './csv';
import type { ReportQueryDto } from './reporting.dto';

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  async dashboard(query: ReportQueryDto, actor: AuthenticatedActor) {
    const now = new Date();
    const { start: startToday, end: endToday } = businessDayBounds(
      now,
      this.config.get('APP_TIMEZONE', { infer: true }),
    );
    const renewalThrough = new Date(
      now.getTime() + this.config.get('RENEWAL_WINDOW_DAYS', { infer: true }) * 86400000,
    );
    const scope = this.scope(query, actor);
    const taskScope =
      canManageAllRecords(actor) && query.ownerId
        ? { assigneeId: query.ownerId }
        : canManageAllRecords(actor)
          ? {}
          : { assigneeId: actor.id };
    const [today, overdue, noRecentActivity, rawRenewals, activeCatalog] = await Promise.all([
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
      this.noRecentActivity(actor),
      this.prisma.contract.findMany({
        where: {
          deletedAt: null,
          ...scope,
          status: 'ACTIVE',
          renewalDate: { lte: renewalThrough },
        },
        include: {
          opportunity: {
            include: { company: true, items: { include: { catalogItem: true } } },
          },
          owner: { select: { name: true } },
        },
        orderBy: { renewalDate: 'asc' },
        take: 10,
      }),
      this.prisma.catalogItem.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } }),
    ]);
    const renewals = rawRenewals.map((contract) => {
      const purchased = new Set(
        contract.opportunity.items.map((item) => item.catalogItem.category),
      );
      const suggestions = new Map<string, (typeof activeCatalog)[number]>();
      for (const item of activeCatalog)
        if (!purchased.has(item.category) && !suggestions.has(item.category))
          suggestions.set(item.category, item);
      return {
        ...contract,
        expansionSuggestions: [...suggestions.values()].map(({ sku, name, category, type }) => ({
          sku,
          name,
          category,
          type,
        })),
      };
    });
    if (actor.role === 'CONSULTANT')
      return { sales: null, today, overdue, noRecentActivity, renewals: [] };
    const currencyScope = query.currency ? { currency: query.currency.toUpperCase() } : {};
    const opportunities = await this.prisma.opportunity.findMany({
      where: {
        deletedAt: null,
        ...scope,
        ...currencyScope,
        stage: { type: StageType.OPEN },
        ...this.dateScope(query, 'closeDate'),
      },
      include: { stage: true, items: { include: { catalogItem: true } } },
    });
    const terminalOpportunities = await this.prisma.opportunity.findMany({
      where: {
        deletedAt: null,
        ...scope,
        ...currencyScope,
        stage: { type: { in: [StageType.WON, StageType.LOST] } },
        ...this.dateScope(query, 'actualCloseDate'),
      },
      include: {
        stage: true,
        stageHistory: {
          where: { toStage: { type: StageType.WON } },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
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
    const won = terminalOpportunities.filter((item) => item.stage.type === StageType.WON);
    const lost = terminalOpportunities.filter((item) => item.stage.type === StageType.LOST);
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
          .filter((item) => item.type === StageType.OPEN)
          .reduce((sum, item) => sum.add(item.weighted), new Prisma.Decimal(0))
          .toString(),
        wonRevenue: won
          .reduce((sum, item) => sum.add(item.expectedValue), new Prisma.Decimal(0))
          .toString(),
        leadConversionRate: leads ? converted / leads : 0,
        winRate: won.length + lost.length ? won.length / (won.length + lost.length) : 0,
        wonCount: won.length,
        lostCount: lost.length,
        averageSalesCycleDays: won.length
          ? won.reduce((sum, item) => {
              const wonAt =
                item.stageHistory[0]?.createdAt ?? item.actualCloseDate ?? item.updatedAt;
              return sum + Math.max(0, wonAt.getTime() - item.createdAt.getTime()) / 86400000;
            }, 0) / won.length
          : 0,
        salesByOffering: [...salesMap].map(([sku, value]) => ({ sku, value: value.toString() })),
        currency: query.currency?.toUpperCase() ?? 'USD',
      },
      today,
      overdue,
      noRecentActivity,
      renewals,
    };
  }

  private async noRecentActivity(actor: AuthenticatedActor) {
    const threshold = new Date(
      Date.now() - this.config.get('NO_ACTIVITY_DAYS', { infer: true }) * 86400000,
    );
    const scope = canManageAllRecords(actor) ? {} : { ownerId: actor.id };
    const stale = {
      deletedAt: null,
      createdAt: { lt: threshold },
      activities: { none: { deletedAt: null, occurredAt: { gte: threshold } } },
      ...scope,
    } as const;
    const [companies, contacts, leads, opportunities] = await Promise.all([
      this.prisma.company.findMany({
        where: stale,
        select: { id: true, name: true, owner: { select: { name: true } } },
        take: 10,
      }),
      this.prisma.contact.findMany({
        where: stale,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          owner: { select: { name: true } },
        },
        take: 10,
      }),
      this.prisma.lead.findMany({
        where: { ...stale, status: { in: ['NEW', 'QUALIFIED'] } },
        select: {
          id: true,
          companyName: true,
          contactFirstName: true,
          contactLastName: true,
          owner: { select: { name: true } },
        },
        take: 10,
      }),
      this.prisma.opportunity.findMany({
        where: { ...stale, stage: { type: StageType.OPEN } },
        select: { id: true, name: true, owner: { select: { name: true } } },
        take: 10,
      }),
    ]);
    return [
      ...companies.map((item) => ({ ...item, entityType: 'COMPANY' as const })),
      ...contacts.map((item) => ({
        id: item.id,
        name: `${item.firstName} ${item.lastName}`,
        owner: item.owner,
        entityType: 'CONTACT' as const,
      })),
      ...leads.map((item) => ({
        id: item.id,
        name: item.companyName ?? `${item.contactFirstName} ${item.contactLastName}`,
        owner: item.owner,
        entityType: 'LEAD' as const,
      })),
      ...opportunities.map((item) => ({ ...item, entityType: 'OPPORTUNITY' as const })),
    ].slice(0, 10);
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
