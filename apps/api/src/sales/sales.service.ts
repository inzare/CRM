import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import type { RequestMetadata } from '../auth/auth.types';
import {
  canManageAllRecords,
  ownerScope,
  type AuthenticatedActor,
} from '../common/authorization-scope';
import { pageMeta } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';
import { serializableTransaction } from '../database/transaction';
import { LeadStatus, Prisma, StageType } from '../generated/prisma/client';

import type {
  ConvertLeadDto,
  CreateLeadDto,
  CreateOpportunityDto,
  QualifyLeadDto,
  SalesListQueryDto,
  TransitionOpportunityDto,
  UpdateLeadDto,
  UpdateOpportunityDto,
  UpdateStageDto,
} from './sales.dto';

const opportunityInclude = {
  company: { select: { id: true, name: true } },
  primaryContact: { select: { id: true, firstName: true, lastName: true } },
  owner: { select: { id: true, name: true } },
  stage: true,
  items: { include: { catalogItem: true } },
  stageHistory: {
    include: {
      fromStage: true,
      toStage: true,
      actor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.OpportunityInclude;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  stages() {
    return this.prisma.pipelineStage.findMany({
      include: { transitionsFrom: { select: { toStageId: true } } },
      orderBy: { order: 'asc' },
    });
  }
  async updateStage(id: string, input: UpdateStageDto) {
    const current = await this.prisma.pipelineStage.findUnique({ where: { id } });
    if (!current) throw this.notFound('Stage');
    if (input.isActive === false) {
      const active = await this.prisma.opportunity.count({
        where: { stageId: id, deletedAt: null },
      });
      if (active)
        throw new ConflictException({
          code: 'STAGE_IN_USE',
          message: 'Move active opportunities before deactivating this stage.',
        });
    }
    if (input.allowedToStageIds?.includes(id))
      throw new ConflictException({
        code: 'INVALID_PIPELINE_CONFIGURATION',
        message: 'A stage cannot transition to itself.',
      });
    if (current.type !== StageType.OPEN && input.allowedToStageIds?.length)
      throw new ConflictException({
        code: 'INVALID_PIPELINE_CONFIGURATION',
        message: 'Terminal stages cannot have outgoing transitions.',
      });
    const { allowedToStageIds, ...stageData } = input;
    return this.prisma.$transaction(async (database) => {
      if (allowedToStageIds) {
        const targets = await database.pipelineStage.count({
          where: { id: { in: allowedToStageIds }, isActive: true },
        });
        if (targets !== new Set(allowedToStageIds).size)
          throw new ConflictException({
            code: 'INVALID_PIPELINE_CONFIGURATION',
            message: 'Every transition target must be an active stage.',
          });
        await database.pipelineTransition.deleteMany({ where: { fromStageId: id } });
        await database.pipelineTransition.createMany({
          data: [...new Set(allowedToStageIds)].map((toStageId) => ({
            fromStageId: id,
            toStageId,
          })),
        });
      }
      return database.pipelineStage.update({
        where: { id },
        data: stageData,
        include: { transitionsFrom: { select: { toStageId: true } } },
      });
    });
  }

  async leads(query: SalesListQueryDto, actor: AuthenticatedActor) {
    const search = query.search?.trim();
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...ownerScope(actor),
      ...(query.ownerId && canManageAllRecords(actor) ? { ownerId: query.ownerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' } },
              { contactFirstName: { contains: search, mode: 'insensitive' } },
              { contactLastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { interest: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
          opportunity: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }

  async createLead(input: CreateLeadDto, actor: AuthenticatedActor, metadata: RequestMetadata) {
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : actor.id;
    return this.prisma.$transaction(async (database) => {
      const created = await database.lead.create({
        data: {
          ownerId,
          companyId: input.companyId ?? null,
          companyName: input.companyName?.trim() ?? null,
          contactFirstName: input.contactFirstName.trim(),
          contactLastName: input.contactLastName.trim(),
          email: input.email?.trim().toLowerCase() ?? null,
          phone: input.phone?.trim() ?? null,
          source: input.source.trim(),
          interest: input.interest.trim(),
          budget: input.budget ? new Prisma.Decimal(input.budget) : null,
          currency: input.currency?.toUpperCase() ?? 'USD',
          expectedTimeline: input.expectedTimeline?.trim() ?? null,
          qualificationNotes: input.qualificationNotes?.trim() ?? null,
        },
        include: { owner: { select: { id: true, name: true } } },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'LEAD_CREATED',
          entityType: 'Lead',
          entityId: created.id,
          requestId: metadata.requestId,
          after: { status: created.status, ownerId },
        },
        database,
      );
      return created;
    });
  }

  lead(id: string, actor: AuthenticatedActor) {
    return this.requireLead(id, actor);
  }

  async updateLead(
    id: string,
    input: UpdateLeadDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const current = await this.requireLead(id, actor);
    if (current.status === LeadStatus.CONVERTED)
      throw new ConflictException({
        code: 'LEAD_STATE_CONFLICT',
        message: 'Converted leads retain immutable source details.',
      });
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : current.ownerId;
    return this.prisma.$transaction(async (database) => {
      const updated = await database.lead.update({
        where: { id },
        data: {
          ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
          ...(input.companyName !== undefined ? { companyName: input.companyName.trim() } : {}),
          ...(input.contactFirstName !== undefined
            ? { contactFirstName: input.contactFirstName.trim() }
            : {}),
          ...(input.contactLastName !== undefined
            ? { contactLastName: input.contactLastName.trim() }
            : {}),
          ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() || null } : {}),
          ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
          ...(input.source !== undefined ? { source: input.source.trim() } : {}),
          ...(input.interest !== undefined ? { interest: input.interest.trim() } : {}),
          ...(input.budget !== undefined
            ? { budget: input.budget ? new Prisma.Decimal(input.budget) : null }
            : {}),
          ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
          ...(input.expectedTimeline !== undefined
            ? { expectedTimeline: input.expectedTimeline.trim() || null }
            : {}),
          ...(input.qualificationNotes !== undefined
            ? { qualificationNotes: input.qualificationNotes.trim() || null }
            : {}),
          ownerId,
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'LEAD_UPDATED',
          entityType: 'Lead',
          entityId: id,
          requestId: metadata.requestId,
          before: { ownerId: current.ownerId },
          after: { ownerId: updated.ownerId },
        },
        database,
      );
      return updated;
    });
  }

  async deleteLead(
    id: string,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    const current = await this.requireLead(id, actor);
    await this.prisma.$transaction(async (database) => {
      await database.lead.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'LEAD_DELETED',
          entityType: 'Lead',
          entityId: id,
          requestId: metadata.requestId,
          before: { status: current.status },
        },
        database,
      );
    });
  }

  async qualifyLead(
    id: string,
    input: QualifyLeadDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const current = await this.requireLead(id, actor);
    if (current.status !== LeadStatus.NEW)
      throw new ConflictException({
        code: 'LEAD_STATE_CONFLICT',
        message: 'Only new leads can be qualified.',
      });
    return this.prisma.$transaction(async (database) => {
      const updated = await database.lead.update({
        where: { id },
        data: {
          status: LeadStatus.QUALIFIED,
          qualifiedAt: new Date(),
          qualificationNotes: input.qualificationNotes.trim(),
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'LEAD_QUALIFIED',
          entityType: 'Lead',
          entityId: id,
          requestId: metadata.requestId,
          before: { status: current.status },
          after: { status: updated.status },
        },
        database,
      );
      return updated;
    });
  }

  async convertLead(
    id: string,
    input: ConvertLeadDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    return this.prisma.$transaction(async (database) => {
      const lead = await database.lead.findFirst({
        where: { id, deletedAt: null, ...ownerScope(actor) },
      });
      if (!lead) throw this.notFound('Lead');
      if (lead.opportunityId)
        return database.opportunity.findUniqueOrThrow({
          where: { id: lead.opportunityId },
          include: opportunityInclude,
        });
      if (lead.status !== LeadStatus.QUALIFIED)
        throw new ConflictException({
          code: 'LEAD_NOT_QUALIFIED',
          message: 'Qualify the lead before conversion.',
        });
      let companyId = lead.companyId;
      if (!companyId) {
        if (!lead.companyName)
          throw new UnprocessableEntityException({
            code: 'COMPANY_REQUIRED',
            message: 'A company is required for conversion.',
          });
        const existing = await database.company.findFirst({
          where: { name: { equals: lead.companyName, mode: 'insensitive' }, deletedAt: null },
        });
        companyId =
          existing?.id ??
          (
            await database.company.create({
              data: { name: lead.companyName, ownerId: lead.ownerId },
            })
          ).id;
      }
      let contact = lead.email
        ? await database.contact.findFirst({
            where: { companyId, email: lead.email, deletedAt: null },
          })
        : null;
      contact ??= await database.contact.create({
        data: {
          companyId,
          ownerId: lead.ownerId,
          firstName: lead.contactFirstName,
          lastName: lead.contactLastName,
          email: lead.email,
          phone: lead.phone,
        },
      });
      const stage = await database.pipelineStage.findUnique({ where: { key: 'discovery' } });
      if (!stage)
        throw new ConflictException({
          code: 'PIPELINE_NOT_CONFIGURED',
          message: 'Discovery stage is not configured.',
        });
      const opportunity = await database.opportunity.create({
        data: {
          name: input.opportunityName.trim(),
          companyId,
          primaryContactId: contact.id,
          ownerId: lead.ownerId,
          stageId: stage.id,
          expectedValue: new Prisma.Decimal(input.expectedValue),
          currency: lead.currency,
          probability: stage.defaultProbability,
          closeDate: new Date(input.closeDate),
          sourceLeadId: lead.id,
          stageHistory: {
            create: { toStageId: stage.id, actorId: actor.id, reason: 'Lead conversion' },
          },
        },
        include: opportunityInclude,
      });
      await database.lead.update({
        where: { id },
        data: {
          companyId,
          opportunityId: opportunity.id,
          status: LeadStatus.CONVERTED,
          convertedAt: new Date(),
        },
      });
      await database.activity.createMany({
        data: [
          {
            type: 'NOTE',
            subject: 'Lead converted to opportunity',
            body: `${lead.contactFirstName} ${lead.contactLastName} converted into ${opportunity.name}.`,
            creatorId: actor.id,
            companyId,
          },
          {
            type: 'NOTE',
            subject: 'Lead converted to opportunity',
            body: `${opportunity.name} was created from the qualified lead.`,
            creatorId: actor.id,
            contactId: contact.id,
          },
        ],
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'LEAD_CONVERTED',
          entityType: 'Lead',
          entityId: id,
          requestId: metadata.requestId,
          after: { opportunityId: opportunity.id, companyId },
        },
        database,
      );
      return opportunity;
    }, serializableTransaction);
  }

  async opportunities(query: SalesListQueryDto, actor: AuthenticatedActor) {
    const search = query.search?.trim();
    const where: Prisma.OpportunityWhereInput = {
      deletedAt: null,
      ...ownerScope(actor),
      ...(query.ownerId && canManageAllRecords(actor) ? { ownerId: query.ownerId } : {}),
      ...(query.stageId ? { stageId: query.stageId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { company: { name: { contains: search, mode: 'insensitive' } } },
              { competitor: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.opportunity.findMany({
        where,
        include: opportunityInclude,
        orderBy: { closeDate: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.opportunity.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }

  async createOpportunity(
    input: CreateOpportunityDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : actor.id;
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: input.stageId, isActive: true },
    });
    if (!stage) throw this.notFound('Stage');
    if (
      input.primaryContactId &&
      !(await this.prisma.contact.findFirst({
        where: { id: input.primaryContactId, companyId: input.companyId, deletedAt: null },
      }))
    )
      throw new UnprocessableEntityException({
        code: 'CONTACT_COMPANY_MISMATCH',
        message: 'Primary contact must belong to the opportunity company.',
      });
    return this.prisma.$transaction(async (database) => {
      const created = await database.opportunity.create({
        data: {
          name: input.name.trim(),
          companyId: input.companyId,
          primaryContactId: input.primaryContactId ?? null,
          ownerId,
          stageId: input.stageId,
          expectedValue: new Prisma.Decimal(input.expectedValue),
          currency: input.currency?.toUpperCase() ?? 'USD',
          probability: input.probability,
          closeDate: new Date(input.closeDate),
          notes: input.notes?.trim() ?? null,
          stageHistory: {
            create: { toStageId: input.stageId, actorId: actor.id, reason: 'Opportunity created' },
          },
        },
        include: opportunityInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'OPPORTUNITY_CREATED',
          entityType: 'Opportunity',
          entityId: created.id,
          requestId: metadata.requestId,
          after: { stageId: created.stageId, expectedValue: created.expectedValue.toString() },
        },
        database,
      );
      return created;
    });
  }

  async opportunity(id: string, actor: AuthenticatedActor) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
      include: opportunityInclude,
    });
    if (!opportunity) throw this.notFound('Opportunity');
    return opportunity;
  }

  async updateOpportunity(
    id: string,
    input: UpdateOpportunityDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const current = await this.prisma.opportunity.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
      include: { stage: true },
    });
    if (!current) throw this.notFound('Opportunity');
    if (current.stage.type !== StageType.OPEN)
      throw new ConflictException({
        code: 'OPPORTUNITY_TERMINAL',
        message: 'Reopen the opportunity before editing commercial details.',
      });
    const companyId = input.companyId ?? current.companyId;
    if (
      input.primaryContactId &&
      !(await this.prisma.contact.findFirst({
        where: { id: input.primaryContactId, companyId, deletedAt: null },
      }))
    )
      throw new UnprocessableEntityException({
        code: 'CONTACT_COMPANY_MISMATCH',
        message: 'Primary contact must belong to the opportunity company.',
      });
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : current.ownerId;
    return this.prisma.$transaction(async (database) => {
      const updated = await database.opportunity.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
          ...(input.primaryContactId !== undefined
            ? { primaryContactId: input.primaryContactId }
            : {}),
          ...(input.expectedValue !== undefined
            ? { expectedValue: new Prisma.Decimal(input.expectedValue) }
            : {}),
          ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
          ...(input.probability !== undefined ? { probability: input.probability } : {}),
          ...(input.closeDate !== undefined ? { closeDate: new Date(input.closeDate) } : {}),
          ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
          ownerId,
        },
        include: opportunityInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'OPPORTUNITY_UPDATED',
          entityType: 'Opportunity',
          entityId: id,
          requestId: metadata.requestId,
          before: { ownerId: current.ownerId, expectedValue: current.expectedValue.toString() },
          after: { ownerId: updated.ownerId, expectedValue: updated.expectedValue.toString() },
        },
        database,
      );
      return updated;
    });
  }

  async deleteOpportunity(
    id: string,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    const current = await this.prisma.opportunity.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
    });
    if (!current) throw this.notFound('Opportunity');
    await this.prisma.$transaction(async (database) => {
      await database.opportunity.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'OPPORTUNITY_DELETED',
          entityType: 'Opportunity',
          entityId: id,
          requestId: metadata.requestId,
          before: { stageId: current.stageId },
        },
        database,
      );
    });
  }

  async transition(
    id: string,
    input: TransitionOpportunityDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    return this.prisma.$transaction(async (database) => {
      const current = await database.opportunity.findFirst({
        where: { id, deletedAt: null, ...ownerScope(actor) },
        include: { stage: true },
      });
      if (!current) throw this.notFound('Opportunity');
      if (current.stageId !== input.expectedStageId)
        throw new ConflictException({
          code: 'STAGE_CONFLICT',
          message: 'The opportunity moved. Refresh the pipeline.',
        });
      const target = await database.pipelineStage.findFirst({
        where: { id: input.toStageId, isActive: true },
      });
      if (!target) throw this.notFound('Stage');
      const terminalReopen = current.stage.type !== StageType.OPEN;
      if (terminalReopen && !canManageAllRecords(actor))
        throw new ForbiddenException({
          code: 'REOPEN_FORBIDDEN',
          message: 'Only managers can reopen terminal opportunities.',
        });
      if (
        !terminalReopen &&
        !(await database.pipelineTransition.findUnique({
          where: { fromStageId_toStageId: { fromStageId: current.stageId, toStageId: target.id } },
        }))
      )
        throw new UnprocessableEntityException({
          code: 'INVALID_STAGE_TRANSITION',
          message: 'That stage transition is not configured.',
        });
      if (
        target.type === StageType.LOST &&
        (!input.lossReason?.trim() || !input.competitor?.trim())
      )
        throw new UnprocessableEntityException({
          code: 'LOSS_DETAILS_REQUIRED',
          message: 'Lost reason and competitor are required.',
        });
      const updated = await database.opportunity.update({
        where: { id },
        data: {
          stageId: target.id,
          probability: target.defaultProbability,
          competitor:
            target.type === StageType.LOST
              ? (input.competitor?.trim() ?? null)
              : current.competitor,
          lossReason: target.type === StageType.LOST ? (input.lossReason?.trim() ?? null) : null,
          actualCloseDate: target.type === StageType.OPEN ? null : new Date(),
          stageHistory: {
            create: {
              fromStageId: current.stageId,
              toStageId: target.id,
              actorId: actor.id,
              reason: input.reason?.trim() ?? input.lossReason?.trim() ?? null,
            },
          },
        },
        include: opportunityInclude,
      });
      const timelineEvent = {
        type: 'NOTE' as const,
        subject: `Opportunity moved to ${target.displayName}`,
        body: input.reason?.trim() ?? input.lossReason?.trim() ?? null,
        creatorId: actor.id,
      };
      await database.activity.createMany({
        data: [
          { ...timelineEvent, companyId: current.companyId },
          ...(current.primaryContactId
            ? [{ ...timelineEvent, contactId: current.primaryContactId }]
            : []),
        ],
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'OPPORTUNITY_STAGE_CHANGED',
          entityType: 'Opportunity',
          entityId: id,
          requestId: metadata.requestId,
          before: { stageId: current.stageId },
          after: {
            stageId: target.id,
            lossReason: updated.lossReason,
            competitor: updated.competitor,
          },
        },
        database,
      );
      return updated;
    }, serializableTransaction);
  }

  async board(query: SalesListQueryDto, actor: AuthenticatedActor) {
    const stages = await this.prisma.pipelineStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        transitionsFrom: { select: { toStageId: true } },
        opportunities: {
          where: {
            deletedAt: null,
            ...ownerScope(actor),
            ...(query.ownerId && canManageAllRecords(actor) ? { ownerId: query.ownerId } : {}),
          },
          include: {
            company: { select: { id: true, name: true } },
            owner: { select: { id: true, name: true } },
          },
          orderBy: { closeDate: 'asc' },
        },
      },
    });
    return stages.map((stage) => ({
      ...stage,
      count: stage.opportunities.length,
      value: stage.opportunities
        .reduce((sum, item) => sum.add(item.expectedValue), new Prisma.Decimal(0))
        .toString(),
    }));
  }

  private async requireLead(id: string, actor: AuthenticatedActor) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
    });
    if (!lead) throw this.notFound('Lead');
    return lead;
  }
  private notFound(entity: string) {
    return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: `${entity} not found.` });
  }
}
