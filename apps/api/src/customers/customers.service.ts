import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import type { RequestMetadata } from '../auth/auth.types';
import {
  canManageAllRecords,
  ownerScope,
  type AuthenticatedActor,
} from '../common/authorization-scope';
import { pageMeta } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';

import type {
  CreateCompanyDto,
  CreateContactDto,
  CustomerListQueryDto,
  TimelineQueryDto,
  UpdateCompanyDto,
  UpdateContactDto,
} from './customers.dto';

const companyInclude = {
  owner: { select: { id: true, name: true } },
  tags: { include: { tag: true } },
  _count: { select: { contacts: true, opportunities: true } },
} satisfies Prisma.CompanyInclude;

const contactInclude = {
  owner: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} satisfies Prisma.ContactInclude;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listCompanies(query: CustomerListQueryDto, actor: AuthenticatedActor) {
    const search = query.search?.trim();
    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...ownerScope(actor),
      ...(query.ownerId && canManageAllRecords(actor) ? { ownerId: query.ownerId } : {}),
      ...(query.industry ? { industry: { equals: query.industry, mode: 'insensitive' } } : {}),
      ...(query.tag
        ? { tags: { some: { tag: { name: { equals: query.tag, mode: 'insensitive' } } } } }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { industry: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: companyInclude,
        orderBy: { name: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.company.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }

  async company(id: string, actor: AuthenticatedActor) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
      include: {
        ...companyInclude,
        contacts: { where: { deletedAt: null }, include: contactInclude },
      },
    });
    if (!company) throw this.notFound('Company');
    return company;
  }

  async createCompany(
    input: CreateCompanyDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const name = input.name.trim();
    const duplicates = await this.prisma.company.findMany({
      where: { deletedAt: null, name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
      take: 5,
    });
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : actor.id;
    const company = await this.prisma.$transaction(async (database) => {
      const created = await database.company.create({
        data: {
          name,
          ownerId,
          industry: input.industry?.trim() ?? null,
          website: input.website?.trim() ?? null,
          size: input.size?.trim() ?? null,
          addressLine1: input.addressLine1?.trim() ?? null,
          addressLine2: input.addressLine2?.trim() ?? null,
          city: input.city?.trim() ?? null,
          state: input.state?.trim() ?? null,
          postalCode: input.postalCode?.trim() ?? null,
          country: input.country?.trim() ?? null,
          notes: input.notes?.trim() ?? null,
          ...(input.tags?.length
            ? {
                tags: {
                  create: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].map(
                    (name) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } }),
                  ),
                },
              }
            : {}),
        },
        include: companyInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'COMPANY_CREATED',
          entityType: 'Company',
          entityId: created.id,
          requestId: metadata.requestId,
          after: { name: created.name, ownerId: created.ownerId },
        },
        database,
      );
      return created;
    });
    return { company, duplicateSuggestions: duplicates };
  }

  async updateCompany(
    id: string,
    input: UpdateCompanyDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const current = await this.prisma.company.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
    });
    if (!current) throw this.notFound('Company');
    if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
      throw this.conflict();
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : current.ownerId;
    return this.prisma.$transaction(async (database) => {
      const updated = await database.company.update({
        where: { id },
        data: {
          name: input.name.trim(),
          ownerId,
          industry: input.industry?.trim() ?? null,
          website: input.website?.trim() ?? null,
          size: input.size?.trim() ?? null,
          addressLine1: input.addressLine1?.trim() ?? null,
          addressLine2: input.addressLine2?.trim() ?? null,
          city: input.city?.trim() ?? null,
          state: input.state?.trim() ?? null,
          postalCode: input.postalCode?.trim() ?? null,
          country: input.country?.trim() ?? null,
          notes: input.notes?.trim() ?? null,
          ...(input.tags
            ? {
                tags: {
                  deleteMany: {},
                  create: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].map(
                    (name) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } }),
                  ),
                },
              }
            : {}),
        },
        include: companyInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'COMPANY_UPDATED',
          entityType: 'Company',
          entityId: id,
          requestId: metadata.requestId,
          before: { name: current.name, ownerId: current.ownerId },
          after: { name: updated.name, ownerId: updated.ownerId },
        },
        database,
      );
      return updated;
    });
  }

  async deleteCompany(
    id: string,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    const current = await this.prisma.company.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
    });
    if (!current) throw this.notFound('Company');
    await this.prisma.$transaction(async (database) => {
      await database.company.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'COMPANY_DELETED',
          entityType: 'Company',
          entityId: id,
          requestId: metadata.requestId,
          before: { name: current.name },
        },
        database,
      );
    });
  }

  async listContacts(query: CustomerListQueryDto, actor: AuthenticatedActor, companyId?: string) {
    const search = query.search?.trim();
    const where: Prisma.ContactWhereInput = {
      deletedAt: null,
      ...ownerScope(actor),
      ...(companyId ? { companyId } : {}),
      ...(query.ownerId && canManageAllRecords(actor) ? { ownerId: query.ownerId } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { jobTitle: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        include: contactInclude,
        orderBy: [{ lastName: query.direction }, { firstName: query.direction }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return { data, meta: pageMeta(query.page, query.pageSize, total) };
  }

  async createContact(
    input: CreateContactDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    await this.requireCompany(input.companyId, actor);
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : actor.id;
    return this.prisma.$transaction(async (database) => {
      const created = await database.contact.create({
        data: { ...this.contactData(input), ownerId },
        include: contactInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'CONTACT_CREATED',
          entityType: 'Contact',
          entityId: created.id,
          requestId: metadata.requestId,
          after: { companyId: created.companyId, email: created.email },
        },
        database,
      );
      return created;
    });
  }

  async updateContact(
    id: string,
    input: UpdateContactDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const current = await this.prisma.contact.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
    });
    if (!current) throw this.notFound('Contact');
    if (current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime())
      throw this.conflict();
    await this.requireCompany(input.companyId, actor);
    const ownerId = canManageAllRecords(actor) && input.ownerId ? input.ownerId : current.ownerId;
    return this.prisma.$transaction(async (database) => {
      const updated = await database.contact.update({
        where: { id },
        data: { ...this.contactData(input), ownerId },
        include: contactInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'CONTACT_UPDATED',
          entityType: 'Contact',
          entityId: id,
          requestId: metadata.requestId,
          before: { companyId: current.companyId, email: current.email },
          after: { companyId: updated.companyId, email: updated.email },
        },
        database,
      );
      return updated;
    });
  }

  async deleteContact(
    id: string,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    const current = await this.prisma.contact.findFirst({
      where: { id, deletedAt: null, ...ownerScope(actor) },
    });
    if (!current) throw this.notFound('Contact');
    await this.prisma.$transaction(async (database) => {
      await database.contact.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'CONTACT_DELETED',
          entityType: 'Contact',
          entityId: id,
          requestId: metadata.requestId,
          before: { email: current.email },
        },
        database,
      );
    });
  }

  async timeline(
    kind: 'company' | 'contact',
    id: string,
    query: TimelineQueryDto,
    actor: AuthenticatedActor,
  ) {
    if (kind === 'company') await this.requireCompany(id, actor);
    else if (
      !(await this.prisma.contact.findFirst({
        where: { id, deletedAt: null, ...ownerScope(actor) },
      }))
    )
      throw this.notFound('Contact');
    const parent = kind === 'company' ? { companyId: id } : { contactId: id };
    const where: Prisma.ActivityWhereInput = {
      ...parent,
      deletedAt: null,
      ...(query.type ? { type: query.type as never } : {}),
      ...(query.actorId ? { creatorId: query.actorId } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where,
        include: { creator: { select: { id: true, name: true } }, task: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.activity.count({ where }),
    ]);
    return {
      data: data.map((event) => ({ ...event, timelineType: event.task ? 'TASK' : event.type })),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  private contactData(input: CreateContactDto) {
    return {
      companyId: input.companyId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      jobTitle: input.jobTitle?.trim() ?? null,
      email: input.email?.trim().toLowerCase() ?? null,
      phone: input.phone?.trim() ?? null,
      isDecisionMaker: input.isDecisionMaker ?? false,
      notes: input.notes?.trim() ?? null,
    };
  }
  private async requireCompany(id: string, actor: AuthenticatedActor): Promise<void> {
    if (
      !(await this.prisma.company.findFirst({
        where: { id, deletedAt: null, ...ownerScope(actor) },
        select: { id: true },
      }))
    )
      throw this.notFound('Company');
  }
  private notFound(entity: string) {
    return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: `${entity} not found.` });
  }
  private conflict() {
    return new ConflictException({
      code: 'OPTIMISTIC_CONFLICT',
      message: 'This record changed. Refresh and try again.',
    });
  }
}
