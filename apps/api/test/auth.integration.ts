import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module';
import { NotificationService } from '../src/auth/notification.service';

let resetToken = '';
let invitationToken = '';

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
