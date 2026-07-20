import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module';
import { NotificationService } from '../src/auth/notification.service';

let resetToken = '';
let invitationToken = '';
let commercialOpportunityId = '';
let commercialStageId = '';

describe('authentication and user authorization API', () => {
  let app: Awaited<ReturnType<typeof createApplication>>;
  let adminToken: string;
  let salesToken: string;

  beforeAll(async () => {
    app = await createApplication();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('signs in, rotates a refresh token, and signs out', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@consultflow.local', password: 'ConsultFlow!2026' })
      .expect(200);
    expect(login.body.user.role).toBe('ADMIN');
    expect(login.body.accessToken).toEqual(expect.any(String));
    adminToken = login.body.accessToken as string;
    const firstCookie = login.headers['set-cookie']?.[0] as string;
    expect(firstCookie).toContain('HttpOnly');
    expect(firstCookie).toContain('SameSite=Strict');

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);
    expect(refresh.body.accessToken).not.toBe(login.body.accessToken);
    const rotatedCookie = refresh.headers['set-cookie']?.[0] as string;
    expect(rotatedCookie).not.toBe(firstCookie);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', rotatedCookie)
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedCookie)
      .expect(401);
  });

  it('uses the same safe response for unknown and invalid credentials', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@example.com', password: 'wrong' })
      .expect(401);
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@consultflow.local', password: 'wrong' })
      .expect(401);
    expect({ code: unknown.body.code, message: unknown.body.message }).toEqual({
      code: invalid.body.code,
      message: invalid.body.message,
    });
  });

  it('enforces ADMIN user-management access', async () => {
    const salesLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@consultflow.local', password: 'ConsultFlow!2026' })
      .expect(200);
    salesToken = salesLogin.body.accessToken as string;

    const adminList = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminList.body.data.length).toBeGreaterThanOrEqual(4);
    expect(adminList.body.data[0]).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(403);
  });

  it('creates, searches, updates, scopes, and soft-deletes customer records', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        name: 'Integration Customer',
        industry: 'Technology',
        website: 'https://integration.example.com',
        tags: ['Priority', 'Mexico'],
      })
      .expect(201);
    expect(created.body.company.duplicateSuggestions).toBeUndefined();
    expect(created.body.duplicateSuggestions).toEqual([]);
    const company = created.body.company;

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'Integration Customer' })
      .expect(201);
    expect(duplicate.body.duplicateSuggestions).toContainEqual({
      id: company.id,
      name: company.name,
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/companies?search=Integration&tag=Priority')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    expect(list.body.data.some((item: { id: string }) => item.id === company.id)).toBe(true);

    const contact = await request(app.getHttpServer())
      .post('/api/v1/contacts')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        companyId: company.id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@integration.example.com',
        isDecisionMaker: true,
      })
      .expect(201);
    expect(contact.body.company.name).toBe('Integration Customer');

    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${String(company.id)}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'Integration Customer Updated', expectedUpdatedAt: company.updatedAt })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${String(company.id)}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'Stale Update', expectedUpdatedAt: company.updatedAt })
      .expect(409);

    const timeline = await request(app.getHttpServer())
      .get(`/api/v1/companies/${String(company.id)}/timeline`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    expect(timeline.body.data).toEqual([]);

    await request(app.getHttpServer())
      .delete(`/api/v1/contacts/${String(contact.body.id)}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${String(company.id)}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/v1/companies/${String(company.id)}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(404);
  });

  it('qualifies and idempotently converts a lead, then enforces pipeline transitions', async () => {
    const lead = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        companyName: 'Pipeline Integration Co',
        contactFirstName: 'Grace',
        contactLastName: 'Hopper',
        email: 'grace@pipeline.example.com',
        source: 'Referral',
        interest: 'Platform modernization',
        budget: '125000',
        currency: 'USD',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/leads/${String(lead.body.id)}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        opportunityName: 'Modernization program',
        expectedValue: '125000',
        closeDate: '2027-03-31',
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/leads/${String(lead.body.id)}/qualify`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ qualificationNotes: 'Sponsor, budget, and delivery window confirmed.' })
      .expect(201);
    const converted = await request(app.getHttpServer())
      .post(`/api/v1/leads/${String(lead.body.id)}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        opportunityName: 'Modernization program',
        expectedValue: '125000',
        closeDate: '2027-03-31',
      })
      .expect(201);
    const repeated = await request(app.getHttpServer())
      .post(`/api/v1/leads/${String(lead.body.id)}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ opportunityName: 'Ignored duplicate', expectedValue: '1', closeDate: '2027-04-01' })
      .expect(201);
    expect(repeated.body.id).toBe(converted.body.id);

    const stages = await request(app.getHttpServer())
      .get('/api/v1/pipeline-stages')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    const won = stages.body.find((stage: { key: string }) => stage.key === 'won');
    const proposal = stages.body.find((stage: { key: string }) => stage.key === 'proposal');
    await request(app.getHttpServer())
      .post(`/api/v1/opportunities/${String(converted.body.id)}/transition`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ expectedStageId: converted.body.stageId, toStageId: won.id })
      .expect(422);
    const moved = await request(app.getHttpServer())
      .post(`/api/v1/opportunities/${String(converted.body.id)}/transition`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        expectedStageId: converted.body.stageId,
        toStageId: proposal.id,
        reason: 'Discovery completed',
      })
      .expect(201);
    expect(moved.body.stage.key).toBe('proposal');
    commercialOpportunityId = moved.body.id as string;
    commercialStageId = moved.body.stageId as string;
    await request(app.getHttpServer())
      .post(`/api/v1/opportunities/${String(converted.body.id)}/transition`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ expectedStageId: converted.body.stageId, toStageId: proposal.id })
      .expect(409);
    const board = await request(app.getHttpServer())
      .get('/api/v1/pipeline')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    expect(
      board.body.find((stage: { key: string }) => stage.key === 'proposal').count,
    ).toBeGreaterThan(0);
  });

  it('snapshots versioned quote totals, accepts a quote, and creates a renewal contract', async () => {
    const catalog = await request(app.getHttpServer())
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'INT-CONSULT',
        name: 'Integration consulting',
        category: 'Consulting',
        type: 'CONSULTING',
        pricingModel: 'ONE_TIME',
        price: '1000',
        currency: 'USD',
        description: 'Integration-tested advisory package',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/opportunities/${commercialOpportunityId}/items`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ catalogItemId: catalog.body.id, quantity: '2.5' })
      .expect(201);
    const quoteInput = {
      opportunityId: commercialOpportunityId,
      validUntil: '2027-02-28',
      notes: 'Net 30',
      lines: [
        {
          catalogItemId: catalog.body.id,
          sku: catalog.body.sku,
          description: catalog.body.name,
          quantity: '2.5',
          unitPrice: '1000',
          discountRate: '10',
          taxRate: '16',
        },
      ],
    };
    const first = await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesToken}`)
      .send(quoteInput)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesToken}`)
      .send(quoteInput)
      .expect(201);
    expect(first.body.version).toBe(1);
    expect(second.body.version).toBe(2);
    expect(first.body.total).toBe('2610');
    await request(app.getHttpServer())
      .post(`/api/v1/quotes/${String(first.body.id)}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/quotes/${String(first.body.id)}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'SENT' })
      .expect(201);
    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/quotes/${String(first.body.id)}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(201);
    expect(accepted.body.status).toBe('ACCEPTED');
    const stages = await request(app.getHttpServer())
      .get('/api/v1/pipeline-stages')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    const negotiation = stages.body.find((stage: { key: string }) => stage.key === 'negotiation');
    const won = stages.body.find((stage: { key: string }) => stage.key === 'won');
    const negotiationMove = await request(app.getHttpServer())
      .post(`/api/v1/opportunities/${commercialOpportunityId}/transition`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ expectedStageId: commercialStageId, toStageId: negotiation.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/opportunities/${commercialOpportunityId}/transition`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ expectedStageId: negotiationMove.body.stageId, toStageId: won.id })
      .expect(201);
    const contract = await request(app.getHttpServer())
      .post('/api/v1/contracts')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        opportunityId: commercialOpportunityId,
        quoteId: first.body.id,
        number: 'C-INT-001',
        startDate: '2027-03-01',
        endDate: '2028-02-29',
        renewalDate: '2028-01-31',
        amount: first.body.total,
        currency: 'USD',
        status: 'ACTIVE',
      })
      .expect(201);
    expect(contract.body.number).toBe('C-INT-001');
  });

  it('links activities and idempotently completes and reopens assigned tasks', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/activities')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ type: 'NOTE', subject: 'Unlinked note' })
      .expect(400);
    const assignees = await request(app.getHttpServer())
      .get('/api/v1/assignees')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    const sales = assignees.body.find((item: { role: string }) => item.role === 'SALES');
    const note = await request(app.getHttpServer())
      .post('/api/v1/activities')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        type: 'NOTE',
        subject: 'Commercial handoff',
        body: 'Accepted proposal handed to delivery.',
        opportunityId: commercialOpportunityId,
      })
      .expect(201);
    expect(note.body.type).toBe('NOTE');
    const task = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        subject: 'Schedule project kickoff',
        description: 'Coordinate customer and delivery calendars.',
        dueAt: '2027-03-02T16:00:00.000Z',
        assigneeId: sales.id,
        opportunityId: commercialOpportunityId,
        priority: 'HIGH',
      })
      .expect(201);
    const completed = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${String(task.body.id)}/complete`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(201);
    expect(completed.body.status).toBe('COMPLETED');
    const repeated = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${String(task.body.id)}/complete`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(201);
    expect(repeated.body.completedAt).toBe(completed.body.completedAt);
    const reopened = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${String(task.body.id)}/reopen`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(201);
    expect(reopened.body.status).toBe('OPEN');
    expect(reopened.body.completedAt).toBeNull();
    const widgets = await request(app.getHttpServer())
      .get('/api/v1/follow-up/widgets')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    expect(widgets.body).toHaveProperty('today');
    expect(widgets.body).toHaveProperty('overdue');
    expect(widgets.body).toHaveProperty('noRecentActivity');
  });

  it('consumes password reset tokens once and revokes old credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'sales@consultflow.local' })
      .expect(202);
    expect(resetToken).toHaveLength(43);

    await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: resetToken, password: 'Fresh-Account-Pass9!' })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: resetToken, password: 'Another-Account-Pass9!' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@consultflow.local', password: 'ConsultFlow!2026' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@consultflow.local', password: 'Fresh-Account-Pass9!' })
      .expect(200);
  });

  it('creates an invited user, accepts once, and deactivates access', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Invited Consultant', email: 'invited@consultflow.local', role: 'CONSULTANT' })
      .expect(201);
    expect(invitationToken).toHaveLength(43);

    await request(app.getHttpServer())
      .post('/api/v1/auth/invitations/accept')
      .send({ token: invitationToken, password: 'Welcome-New-Pass9!' })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/invitations/accept')
      .send({ token: invitationToken, password: 'Welcome-New-Pass9!' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'invited@consultflow.local', password: 'Welcome-New-Pass9!' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${String(created.body.id)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'invited@consultflow.local', password: 'Welcome-New-Pass9!' })
      .expect(401);
  });

  it('exposes retained audit events only to ADMIN', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?action=USER_DEACTIVATED')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(result.body.data[0]).toMatchObject({ action: 'USER_DEACTIVATED', entityType: 'User' });
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(403);
  });
});

async function createApplication() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(NotificationService)
    .useValue({
      sendPasswordReset: vi.fn((_email: string, token: string) => {
        resetToken = token;
      }),
      sendInvitation: vi.fn((_email: string, token: string) => {
        invitationToken = token;
      }),
    })
    .compile();
  const application = moduleRef.createNestApplication();
  application.use(cookieParser());
  application.setGlobalPrefix('api/v1');
  application.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await application.init();
  return application;
}
