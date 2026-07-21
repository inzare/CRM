import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditService } from '../audit/audit.service';
import type { RequestMetadata } from '../auth/auth.types';
import {
  canManageAllRecords,
  ownerScope,
  type AuthenticatedActor,
} from '../common/authorization-scope';
import { pageMeta } from '../common/pagination';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { serializableTransaction } from '../database/transaction';
import { Prisma, QuoteStatus, StageType } from '../generated/prisma/client';

import type {
  CatalogItemDto,
  CommercialListQueryDto,
  CreateContractDto,
  CreateQuoteDto,
  OpportunityItemDto,
  RenewalQueryDto,
  UpdateContractDto,
  UpdateQuoteDto,
} from './commercial.dto';
import { calculateQuote } from './quote-calculator';

const quoteInclude = {
  lines: { orderBy: { sortOrder: 'asc' as const } },
  opportunity: {
    include: {
      company: true,
      primaryContact: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.QuoteInclude;
@Injectable()
export class CommercialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  async catalog(query: CommercialListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.CatalogItemWhereInput = {
      deletedAt: null,
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(query.category ? { category: query.category } : {}),
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.catalogItem.findMany({
        where,
        orderBy: { name: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }
  async createCatalog(input: CatalogItemDto, actor: AuthenticatedActor, metadata: RequestMetadata) {
    return this.prisma.$transaction(async (db) => {
      const created = await db.catalogItem.create({
        data: {
          sku: input.sku.trim().toUpperCase(),
          name: input.name.trim(),
          category: input.category.trim(),
          type: input.type,
          pricingModel: input.pricingModel,
          price: new Prisma.Decimal(input.price),
          currency: input.currency?.toUpperCase() ?? 'USD',
          isActive: input.isActive ?? true,
          description: input.description?.trim() ?? null,
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'CATALOG_ITEM_CREATED',
          entityType: 'CatalogItem',
          entityId: created.id,
          requestId: metadata.requestId,
          after: { sku: created.sku, price: created.price.toString() },
        },
        db,
      );
      return created;
    });
  }
  async updateCatalog(
    id: string,
    input: CatalogItemDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const current = await this.prisma.catalogItem.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw this.notFound('Catalog item');
    return this.prisma.$transaction(async (db) => {
      const updated = await db.catalogItem.update({
        where: { id },
        data: {
          sku: input.sku.trim().toUpperCase(),
          name: input.name.trim(),
          category: input.category.trim(),
          type: input.type,
          pricingModel: input.pricingModel,
          price: new Prisma.Decimal(input.price),
          currency: input.currency?.toUpperCase() ?? current.currency,
          isActive: input.isActive ?? current.isActive,
          description: input.description?.trim() ?? null,
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'CATALOG_ITEM_UPDATED',
          entityType: 'CatalogItem',
          entityId: id,
          requestId: metadata.requestId,
          before: { sku: current.sku, isActive: current.isActive },
          after: { sku: updated.sku, isActive: updated.isActive },
        },
        db,
      );
      return updated;
    });
  }
  async addOffering(
    opportunityId: string,
    input: OpportunityItemDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null, ...ownerScope(actor) },
      include: { stage: true },
    });
    if (!opportunity) throw this.notFound('Opportunity');
    if (opportunity.stage.type !== StageType.OPEN)
      throw new ConflictException({
        code: 'TERMINAL_OPPORTUNITY',
        message: 'Offerings cannot be changed on a closed opportunity.',
      });
    const item = await this.prisma.catalogItem.findFirst({
      where: { id: input.catalogItemId, isActive: true, deletedAt: null },
    });
    if (!item) throw this.notFound('Catalog item');
    const quantity = new Prisma.Decimal(input.quantity);
    if (quantity.lte(0))
      throw new UnprocessableEntityException({
        code: 'INVALID_QUANTITY',
        message: 'Quantity must be greater than zero.',
      });
    return this.prisma.$transaction(async (database) => {
      const offering = await database.opportunityItem.upsert({
        where: { opportunityId_catalogItemId: { opportunityId, catalogItemId: item.id } },
        update: {
          quantity,
          unitPrice: input.unitPrice ? new Prisma.Decimal(input.unitPrice) : item.price,
          billingNotes: input.billingNotes?.trim() ?? null,
        },
        create: {
          opportunityId,
          catalogItemId: item.id,
          quantity,
          unitPrice: input.unitPrice ? new Prisma.Decimal(input.unitPrice) : item.price,
          currency: item.currency,
          billingNotes: input.billingNotes?.trim() ?? null,
        },
        include: { catalogItem: true },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'OPPORTUNITY_OFFERING_UPSERTED',
          entityType: 'Opportunity',
          entityId: opportunityId,
          requestId: metadata.requestId,
          after: { catalogItemId: item.id, quantity: quantity.toString() },
        },
        database,
      );
      return offering;
    });
  }
  async removeOffering(
    opportunityId: string,
    catalogItemId: string,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null, ...ownerScope(actor) },
      include: { stage: true },
    });
    if (!opportunity) throw this.notFound('Opportunity');
    if (opportunity.stage.type !== StageType.OPEN)
      throw new ConflictException({
        code: 'TERMINAL_OPPORTUNITY',
        message: 'Offerings cannot be changed on a closed opportunity.',
      });
    const current = await this.prisma.opportunityItem.findUnique({
      where: { opportunityId_catalogItemId: { opportunityId, catalogItemId } },
    });
    if (!current) throw this.notFound('Opportunity offering');
    await this.prisma.$transaction(async (database) => {
      await database.opportunityItem.delete({ where: { id: current.id } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'OPPORTUNITY_OFFERING_REMOVED',
          entityType: 'Opportunity',
          entityId: opportunityId,
          requestId: metadata.requestId,
          before: { catalogItemId, quantity: current.quantity.toString() },
        },
        database,
      );
    });
  }
  async createQuote(input: CreateQuoteDto, actor: AuthenticatedActor, metadata: RequestMetadata) {
    const calculation = calculateQuote(input.lines);
    return this.prisma.$transaction(async (db) => {
      const opportunity = await db.opportunity.findFirst({
        where: { id: input.opportunityId, deletedAt: null, ...ownerScope(actor) },
      });
      if (!opportunity) throw this.notFound('Opportunity');
      const aggregate = await db.quote.aggregate({
        where: { opportunityId: input.opportunityId },
        _max: { version: true },
      });
      const version = (aggregate._max.version ?? 0) + 1;
      const number = `Q-${new Date().getUTCFullYear()}-${opportunity.id.slice(0, 8).toUpperCase()}-V${version}`;
      const quote = await db.quote.create({
        data: {
          opportunityId: input.opportunityId,
          number,
          version,
          currency: opportunity.currency,
          validUntil: new Date(input.validUntil),
          notes: input.notes?.trim() ?? null,
          subtotal: calculation.subtotal,
          discountTotal: calculation.discountTotal,
          taxTotal: calculation.taxTotal,
          total: calculation.total,
          lines: { create: calculation.lines },
        },
        include: quoteInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'QUOTE_CREATED',
          entityType: 'Quote',
          entityId: quote.id,
          requestId: metadata.requestId,
          after: { number, version, total: quote.total.toString(), status: quote.status },
        },
        db,
      );
      return quote;
    }, serializableTransaction);
  }
  async updateQuote(
    id: string,
    input: UpdateQuoteDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const calculation = calculateQuote(input.lines);
    return this.prisma.$transaction(async (database) => {
      const current = await database.quote.findFirst({
        where: { id, opportunity: { deletedAt: null, ...ownerScope(actor) } },
      });
      if (!current) throw this.notFound('Quote');
      if (current.status !== QuoteStatus.DRAFT)
        throw new ConflictException({
          code: 'QUOTE_IMMUTABLE',
          message: 'Only draft quotes can be edited; create a new version instead.',
        });
      await database.quoteLine.deleteMany({ where: { quoteId: id } });
      const updated = await database.quote.update({
        where: { id },
        data: {
          validUntil: new Date(input.validUntil),
          notes: input.notes?.trim() ?? null,
          subtotal: calculation.subtotal,
          discountTotal: calculation.discountTotal,
          taxTotal: calculation.taxTotal,
          total: calculation.total,
          lines: { create: calculation.lines },
        },
        include: quoteInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'QUOTE_UPDATED',
          entityType: 'Quote',
          entityId: id,
          requestId: metadata.requestId,
          before: { total: current.total.toString() },
          after: { total: updated.total.toString() },
        },
        database,
      );
      return updated;
    });
  }
  async quotes(query: CommercialListQueryDto, actor: AuthenticatedActor) {
    const where: Prisma.QuoteWhereInput = {
      opportunity: { deletedAt: null, ...ownerScope(actor) },
      ...(query.opportunityId ? { opportunityId: query.opportunityId } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        include: quoteInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.quote.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }
  async quote(id: string, actor: AuthenticatedActor) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, opportunity: { deletedAt: null, ...ownerScope(actor) } },
      include: quoteInclude,
    });
    if (!quote) throw this.notFound('Quote');
    return quote;
  }
  async transitionQuote(
    id: string,
    status: QuoteStatus,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (db) => {
      const current = await db.quote.findFirst({
        where: { id, opportunity: { deletedAt: null, ...ownerScope(actor) } },
        include: {
          opportunity: { select: { name: true, companyId: true, primaryContactId: true } },
        },
      });
      if (!current) throw this.notFound('Quote');
      if (current.status === status)
        return {
          quote: await db.quote.findUniqueOrThrow({ where: { id }, include: quoteInclude }),
          expiredConflict: false,
        };
      const now = new Date();
      const expiredConflict =
        current.status === QuoteStatus.SENT &&
        current.validUntil < now &&
        status !== QuoteStatus.EXPIRED;
      const nextStatus = expiredConflict ? QuoteStatus.EXPIRED : status;
      const allowed: Record<QuoteStatus, QuoteStatus[]> = {
        DRAFT: [QuoteStatus.SENT],
        SENT: [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
        ACCEPTED: [],
        REJECTED: [],
        EXPIRED: [],
      };
      if (!allowed[current.status].includes(nextStatus))
        throw new ConflictException({
          code: 'INVALID_QUOTE_TRANSITION',
          message: `Quote cannot move from ${current.status} to ${nextStatus}.`,
        });
      if (
        nextStatus === QuoteStatus.ACCEPTED &&
        (await db.quote.count({
          where: {
            opportunityId: current.opportunityId,
            status: QuoteStatus.ACCEPTED,
            id: { not: id },
          },
        })) > 0
      )
        throw new ConflictException({
          code: 'QUOTE_ALREADY_ACCEPTED',
          message: 'This opportunity already has an accepted quote.',
        });
      const updated = await db.quote.update({
        where: { id },
        data: {
          status: nextStatus,
          sentAt: nextStatus === QuoteStatus.SENT ? now : current.sentAt,
          acceptedAt: nextStatus === QuoteStatus.ACCEPTED ? now : null,
          rejectedAt: nextStatus === QuoteStatus.REJECTED ? now : null,
          expiredAt: nextStatus === QuoteStatus.EXPIRED ? now : null,
        },
        include: quoteInclude,
      });
      const timelineEvent = {
        type: 'NOTE' as const,
        subject: `Quote ${updated.number} ${nextStatus.toLowerCase()}`,
        body: `${current.opportunity.name} quote status changed from ${current.status} to ${nextStatus}.`,
        creatorId: actor.id,
      };
      await db.activity.createMany({
        data: [
          { ...timelineEvent, companyId: current.opportunity.companyId },
          ...(current.opportunity.primaryContactId
            ? [{ ...timelineEvent, contactId: current.opportunity.primaryContactId }]
            : []),
        ],
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'QUOTE_STATUS_CHANGED',
          entityType: 'Quote',
          entityId: id,
          requestId: metadata.requestId,
          before: { status: current.status },
          after: { status: nextStatus },
        },
        db,
      );
      return { quote: updated, expiredConflict };
    }, serializableTransaction);
    if (result.expiredConflict)
      throw new ConflictException({
        code: 'QUOTE_EXPIRED',
        message: 'The quote expired before this transition and is now marked Expired.',
      });
    return result.quote;
  }
  async createContract(
    input: CreateContractDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : actor.id;
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: input.quoteId,
        opportunityId: input.opportunityId,
        status: QuoteStatus.ACCEPTED,
        opportunity: { deletedAt: null, ...ownerScope(actor) },
      },
      include: { opportunity: { include: { stage: true } } },
    });
    if (!quote || quote.opportunity.stage.type !== StageType.WON)
      throw new ConflictException({
        code: 'CONTRACT_PREREQUISITES',
        message: 'Contracts require a won opportunity and accepted quote.',
      });
    const start = new Date(input.startDate);
    const end = input.endDate ? new Date(input.endDate) : null;
    const renewal = input.renewalDate ? new Date(input.renewalDate) : null;
    if ((end && end < start) || (renewal && renewal < start))
      throw new UnprocessableEntityException({
        code: 'INVALID_CONTRACT_DATES',
        message: 'End and renewal dates must not precede the start date.',
      });
    return this.prisma.$transaction(async (db) => {
      const contract = await db.contract.create({
        data: {
          opportunityId: input.opportunityId,
          quoteId: input.quoteId,
          ownerId,
          number: input.number.trim(),
          startDate: start,
          endDate: end,
          renewalDate: renewal,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency?.toUpperCase() ?? quote.currency,
          status: input.status ?? 'DRAFT',
          renewalNotes: input.renewalNotes?.trim() ?? null,
        },
        include: {
          opportunity: { include: { company: true, items: { include: { catalogItem: true } } } },
          quote: true,
          owner: { select: { id: true, name: true } },
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'CONTRACT_CREATED',
          entityType: 'Contract',
          entityId: contract.id,
          requestId: metadata.requestId,
          after: { number: contract.number, amount: contract.amount.toString() },
        },
        db,
      );
      return contract;
    });
  }
  async renewals(query: RenewalQueryDto, actor: AuthenticatedActor) {
    const days = query.days ?? this.config.get('RENEWAL_WINDOW_DAYS', { infer: true }) ?? 30;
    const through = new Date(Date.now() + days * 86400000);
    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
      ...ownerScope(actor),
      renewalDate: { gte: new Date(), lte: through },
    };
    const [data, activeCatalog] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: {
          opportunity: { include: { company: true, items: { include: { catalogItem: true } } } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: { renewalDate: 'asc' },
        take: query.pageSize,
      }),
      this.prisma.catalogItem.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return {
      data: data.map((contract) => ({
        ...contract,
        suggestions: this.expansionSuggestions(contract.opportunity.items, activeCatalog),
      })),
      meta: pageMeta(1, query.pageSize, data.length),
    };
  }
  private expansionSuggestions(
    purchased: Array<{ catalogItem: { category: string } }>,
    activeCatalog: Array<{ sku: string; name: string; type: string; category: string }>,
  ) {
    const purchasedCategories = new Set(purchased.map((item) => item.catalogItem.category));
    const suggestions = new Map<string, (typeof activeCatalog)[number]>();
    for (const item of activeCatalog)
      if (!purchasedCategories.has(item.category) && !suggestions.has(item.category))
        suggestions.set(item.category, item);
    return [...suggestions.values()].map(({ sku, name, type, category }) => ({
      sku,
      name,
      type,
      category,
    }));
  }
  async contracts(query: CommercialListQueryDto, actor: AuthenticatedActor) {
    const where: Prisma.ContractWhereInput = { deletedAt: null, ...ownerScope(actor) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        include: {
          opportunity: { include: { company: true } },
          quote: true,
          owner: { select: { id: true, name: true } },
        },
        orderBy: { renewalDate: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.contract.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }
  async contract(id: string, actor: AuthenticatedActor) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
      include: {
        opportunity: { include: { company: true } },
        quote: true,
        owner: { select: { id: true, name: true } },
      },
    });
    if (!contract) throw this.notFound('Contract');
    return contract;
  }
  async updateContract(
    id: string,
    input: UpdateContractDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const current = await this.prisma.contract.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
    });
    if (!current) throw this.notFound('Contract');
    const start = input.startDate ? new Date(input.startDate) : current.startDate;
    const end = input.endDate ? new Date(input.endDate) : current.endDate;
    const renewal = input.renewalDate ? new Date(input.renewalDate) : current.renewalDate;
    if ((end && end < start) || (renewal && renewal < start))
      throw new UnprocessableEntityException({
        code: 'INVALID_CONTRACT_DATES',
        message: 'End and renewal dates must not precede the start date.',
      });
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : current.ownerId;
    return this.prisma.$transaction(async (database) => {
      const updated = await database.contract.update({
        where: { id },
        data: {
          ...(input.number !== undefined ? { number: input.number.trim() } : {}),
          ...(input.startDate !== undefined ? { startDate: start } : {}),
          ...(input.endDate !== undefined ? { endDate: end } : {}),
          ...(input.renewalDate !== undefined ? { renewalDate: renewal } : {}),
          ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}),
          ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.renewalNotes !== undefined
            ? { renewalNotes: input.renewalNotes.trim() || null }
            : {}),
          ownerId,
        },
        include: {
          opportunity: { include: { company: true } },
          quote: true,
          owner: { select: { id: true, name: true } },
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'CONTRACT_UPDATED',
          entityType: 'Contract',
          entityId: id,
          requestId: metadata.requestId,
          before: { status: current.status, ownerId: current.ownerId },
          after: { status: updated.status, ownerId: updated.ownerId },
        },
        database,
      );
      return updated;
    });
  }
  async deleteContract(
    id: string,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    const current = await this.prisma.contract.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
    });
    if (!current) throw this.notFound('Contract');
    await this.prisma.$transaction(async (database) => {
      await database.contract.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'CONTRACT_DELETED',
          entityType: 'Contract',
          entityId: id,
          requestId: metadata.requestId,
          before: { number: current.number, status: current.status },
        },
        database,
      );
    });
  }
  private notFound(entity: string) {
    return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: `${entity} not found.` });
  }
}
