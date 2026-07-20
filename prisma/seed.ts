import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id, hash } from 'argon2';

import {
  ActivityType,
  CatalogType,
  ContractStatus,
  LeadStatus,
  PricingModel,
  PrismaClient,
  QuoteStatus,
  Role,
  StageType,
  TaskPriority,
} from '../apps/api/src/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed ConsultFlow CRM.');

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  manager: '00000000-0000-4000-8000-000000000002',
  sales: '00000000-0000-4000-8000-000000000003',
  consultant: '00000000-0000-4000-8000-000000000004',
  companyA: '20000000-0000-4000-8000-000000000001',
  companyB: '20000000-0000-4000-8000-000000000002',
  contactA: '30000000-0000-4000-8000-000000000001',
  lead: '40000000-0000-4000-8000-000000000001',
  opportunity: '50000000-0000-4000-8000-000000000001',
  quote: '70000000-0000-4000-8000-000000000001',
} as const;

async function seedUsers(): Promise<void> {
  // Argon2 0.45's declaration currently widens encoded hashes to Promise<any>.
  const passwordHash = await (hash('ConsultFlow!2026', { type: argon2id }) as Promise<string>);
  const users = [
    { id: ids.admin, name: 'Ana Torres', email: 'admin@consultflow.local', role: Role.ADMIN },
    { id: ids.manager, name: 'Marco Ruiz', email: 'manager@consultflow.local', role: Role.MANAGER },
    { id: ids.sales, name: 'Sofia Delgado', email: 'sales@consultflow.local', role: Role.SALES },
    {
      id: ids.consultant,
      name: 'Diego Herrera',
      email: 'consultant@consultflow.local',
      role: Role.CONSULTANT,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, isActive: true, passwordHash },
      create: { ...user, passwordHash },
    });
  }
}

async function seedPipeline(): Promise<Record<string, string>> {
  const stages = [
    ['new-lead', 'New Lead', 1, StageType.OPEN, 10],
    ['qualified', 'Qualified', 2, StageType.OPEN, 25],
    ['discovery', 'Discovery', 3, StageType.OPEN, 40],
    ['proposal', 'Proposal', 4, StageType.OPEN, 60],
    ['negotiation', 'Negotiation', 5, StageType.OPEN, 80],
    ['won', 'Won', 6, StageType.WON, 100],
    ['lost', 'Lost', 7, StageType.LOST, 0],
  ] as const;
  const stageIds: Record<string, string> = {};
  for (const [key, displayName, order, type, defaultProbability] of stages) {
    const stage = await prisma.pipelineStage.upsert({
      where: { key },
      update: { displayName, order, type, defaultProbability, isActive: true },
      create: { key, displayName, order, type, defaultProbability },
    });
    stageIds[key] = stage.id;
  }
  const openKeys = ['new-lead', 'qualified', 'discovery', 'proposal', 'negotiation'] as const;
  for (let index = 0; index < openKeys.length; index += 1) {
    const fromStageId = stageIds[openKeys[index]!];
    const next = openKeys[index + 1];
    const targets = next ? [next, 'lost'] : ['won', 'lost'];
    for (const target of targets) {
      const toStageId = stageIds[target];
      if (!fromStageId || !toStageId)
        throw new Error(`Missing seeded transition ${String(openKeys[index])} -> ${target}`);
      await prisma.pipelineTransition.upsert({
        where: { fromStageId_toStageId: { fromStageId, toStageId } },
        update: {},
        create: { fromStageId, toStageId },
      });
    }
  }
  return stageIds;
}

async function seedCrm(stageIds: Record<string, string>): Promise<void> {
  const strategic = await prisma.tag.upsert({
    where: { name: 'Strategic' },
    update: { color: '#0f9f94' },
    create: { name: 'Strategic', color: '#0f9f94' },
  });
  await prisma.tag.upsert({
    where: { name: 'SaaS' },
    update: { color: '#314863' },
    create: { name: 'SaaS', color: '#314863' },
  });

  await prisma.company.upsert({
    where: { id: ids.companyA },
    update: {},
    create: {
      id: ids.companyA,
      name: 'Northstar Logistics',
      industry: 'Logistics & Supply Chain',
      website: 'https://northstar.example',
      size: '201-500',
      city: 'Monterrey',
      state: 'Nuevo Le?n',
      country: 'Mexico',
      ownerId: ids.sales,
      notes: 'Modernizing customer operations and fleet analytics.',
      tags: { create: { tagId: strategic.id } },
    },
  });
  await prisma.company.upsert({
    where: { id: ids.companyB },
    update: {},
    create: {
      id: ids.companyB,
      name: 'Aster Health Systems',
      industry: 'Healthcare Technology',
      website: 'https://aster.example',
      size: '51-200',
      city: 'Guadalajara',
      state: 'Jalisco',
      country: 'Mexico',
      ownerId: ids.sales,
      notes: 'Evaluating implementation and annual licensing.',
    },
  });
  await prisma.contact.upsert({
    where: { id: ids.contactA },
    update: {},
    create: {
      id: ids.contactA,
      companyId: ids.companyA,
      ownerId: ids.sales,
      firstName: 'Elena',
      lastName: 'Vargas',
      jobTitle: 'VP, Digital Operations',
      email: 'elena.vargas@northstar.example',
      phone: '+52 81 5555 0138',
      isDecisionMaker: true,
    },
  });
  await prisma.lead.upsert({
    where: { id: ids.lead },
    update: {},
    create: {
      id: ids.lead,
      ownerId: ids.sales,
      companyName: 'Aster Health Systems',
      contactFirstName: 'Luc?a',
      contactLastName: 'Mendoza',
      email: 'lucia@aster.example',
      source: 'Partner referral',
      interest: 'Annual analytics licenses and implementation package',
      budget: '95000',
      expectedTimeline: 'Q4 2026',
      qualificationNotes: 'Budget confirmed; technical discovery scheduled.',
      status: LeadStatus.QUALIFIED,
      qualifiedAt: new Date('2026-07-15T16:00:00Z'),
    },
  });
  await prisma.opportunity.upsert({
    where: { id: ids.opportunity },
    update: {},
    create: {
      id: ids.opportunity,
      name: 'Northstar operations platform',
      companyId: ids.companyA,
      primaryContactId: ids.contactA,
      ownerId: ids.sales,
      stageId: stageIds.proposal!,
      expectedValue: '148500',
      probability: 60,
      closeDate: new Date('2026-09-30T00:00:00Z'),
      competitor: 'Internal build',
      notes: 'Proposal includes implementation, licenses, and enablement.',
      stageHistory: {
        create: {
          toStageId: stageIds.proposal!,
          actorId: ids.sales,
          reason: 'Seeded active proposal',
        },
      },
    },
  });
}

async function seedCommercial(): Promise<void> {
  const implementation = await prisma.catalogItem.upsert({
    where: { sku: 'IMPL-ENTERPRISE' },
    update: {},
    create: {
      sku: 'IMPL-ENTERPRISE',
      name: 'Enterprise implementation',
      category: 'Implementation',
      type: CatalogType.IMPLEMENTATION,
      pricingModel: PricingModel.FIXED,
      price: '62500',
      description:
        'Discovery, architecture, integration, migration, enablement, and launch support.',
    },
  });
  const licenses = await prisma.catalogItem.upsert({
    where: { sku: 'LIC-ANALYTICS-100' },
    update: {},
    create: {
      sku: 'LIC-ANALYTICS-100',
      name: 'Analytics platform ? 100 users',
      category: 'Software',
      type: CatalogType.LICENSE,
      pricingModel: PricingModel.RECURRING,
      price: '86000',
      description: 'Annual platform license with standard support.',
    },
  });
  for (const [catalogItemId, quantity, unitPrice, sortOrder] of [
    [implementation.id, '1', '62500', 1],
    [licenses.id, '1', '86000', 2],
  ] as const) {
    await prisma.opportunityItem.upsert({
      where: { opportunityId_catalogItemId: { opportunityId: ids.opportunity, catalogItemId } },
      update: { quantity, unitPrice, sortOrder },
      create: { opportunityId: ids.opportunity, catalogItemId, quantity, unitPrice, sortOrder },
    });
  }
  await prisma.quote.upsert({
    where: { id: ids.quote },
    update: {},
    create: {
      id: ids.quote,
      opportunityId: ids.opportunity,
      number: 'CF-2026-0001',
      version: 1,
      status: QuoteStatus.SENT,
      subtotal: '148500',
      discountTotal: '7425',
      taxTotal: '22572',
      total: '163647',
      validUntil: new Date('2026-08-15T00:00:00Z'),
      sentAt: new Date('2026-07-18T18:00:00Z'),
      notes: 'Pricing valid for 30 days. Taxes shown at 16%.',
      lines: {
        create: [
          {
            catalogItemId: implementation.id,
            sku: implementation.sku,
            description: implementation.name,
            quantity: '1',
            unitPrice: '62500',
            discountRate: '5',
            taxRate: '16',
            subtotal: '62500',
            discount: '3125',
            tax: '9500',
            total: '68875',
            sortOrder: 1,
          },
          {
            catalogItemId: licenses.id,
            sku: licenses.sku,
            description: licenses.name,
            quantity: '1',
            unitPrice: '86000',
            discountRate: '5',
            taxRate: '16',
            subtotal: '86000',
            discount: '4300',
            tax: '13072',
            total: '94772',
            sortOrder: 2,
          },
        ],
      },
    },
  });
  await prisma.contract.upsert({
    where: { number: 'CF-CON-2026-0042' },
    update: {},
    create: {
      number: 'CF-CON-2026-0042',
      opportunityId: ids.opportunity,
      quoteId: ids.quote,
      ownerId: ids.sales,
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2027-07-31T00:00:00Z'),
      renewalDate: new Date('2027-07-01T00:00:00Z'),
      amount: '163647',
      status: ContractStatus.DRAFT,
      renewalNotes: 'Review license expansion 60 days before renewal.',
    },
  });
}

async function seedWork(): Promise<void> {
  await prisma.activity.upsert({
    where: { id: '80000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '80000000-0000-4000-8000-000000000001',
      type: ActivityType.MEETING,
      subject: 'Proposal walkthrough',
      body: 'Confirmed implementation approach and procurement steps.',
      occurredAt: new Date('2026-07-18T17:00:00Z'),
      opportunityId: ids.opportunity,
      creatorId: ids.sales,
    },
  });
  await prisma.task.upsert({
    where: { id: '90000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '90000000-0000-4000-8000-000000000001',
      subject: 'Confirm security review participants',
      description: 'Coordinate customer security and architecture stakeholders before discovery.',
      priority: TaskPriority.HIGH,
      dueAt: new Date('2026-07-21T16:00:00Z'),
      opportunityId: ids.opportunity,
      assigneeId: ids.consultant,
      creatorId: ids.sales,
    },
  });
}

async function main(): Promise<void> {
  await seedUsers();
  const stages = await seedPipeline();
  await seedCrm(stages);
  await seedCommercial();
  await seedWork();
  console.info('ConsultFlow seed complete. Local password: ConsultFlow!2026');
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
