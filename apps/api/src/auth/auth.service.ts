import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuditService } from '../audit/audit.service';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { serializableTransaction } from '../database/transaction';
import type { User } from '../generated/prisma/client';

import type { AuthenticatedUser, RequestMetadata } from './auth.types';
import { NotificationService } from './notification.service';
import { PasswordService } from './password.service';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=1,t=3$5aJtDI3ppX7DOokWCeGyLQ$1Um6cmrpxPBkcHCcw/Fc6S3SPpDIeJhoCysFOvJzCqQ';

interface SessionResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
    private readonly passwords: PasswordService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async login(
    emailInput: string,
    password: string,
    metadata: RequestMetadata,
  ): Promise<SessionResult> {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordMatches = await this.passwords.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    );
    if (!user || !user.passwordHash || !passwordMatches || !user.isActive || user.deletedAt) {
      await this.audit.record({
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'Authentication',
        requestId: metadata.requestId,
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
        metadata: { emailHash: this.sha256(email) },
      });
      throw this.authenticationFailed();
    }

    const refreshToken = this.randomToken();
    const refreshExpiresAt = this.refreshExpiry();
    await this.prisma.$transaction(async (database) => {
      await database.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await database.refreshSession.create({
        data: {
          userId: user.id,
          familyId: randomUUID(),
          tokenHash: this.hashRefreshToken(refreshToken),
          expiresAt: refreshExpiresAt,
          ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
          ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 512) } : {}),
        },
      });
      await this.audit.record(
        {
          actorId: user.id,
          action: 'AUTH_LOGIN_SUCCEEDED',
          entityType: 'User',
          entityId: user.id,
          requestId: metadata.requestId,
          ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
          ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
        },
        database,
      );
    });
    return {
      accessToken: await this.issueAccessToken(user),
      refreshToken,
      refreshExpiresAt,
      user: this.safeUser(user),
    };
  }

  async refresh(rawToken: string | undefined, metadata: RequestMetadata): Promise<SessionResult> {
    if (!rawToken) throw this.sessionRevoked();

    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.hashRefreshToken(rawToken) },
      include: { user: true },
    });
    if (
      !session ||
      session.expiresAt <= new Date() ||
      !session.user.isActive ||
      session.user.deletedAt
    ) {
      throw this.sessionRevoked();
    }
    if (session.revokedAt) {
      await this.prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw this.sessionRevoked();
    }

    const refreshToken = this.randomToken();
    const refreshExpiresAt = this.refreshExpiry();
    const rotated = await this.prisma.$transaction(async (database) => {
      const claimed = await database.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) {
        await database.refreshSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return false;
      }
      const successor = await database.refreshSession.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: this.hashRefreshToken(refreshToken),
          expiresAt: refreshExpiresAt,
          ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
          ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 512) } : {}),
        },
      });
      await database.refreshSession.update({
        where: { id: session.id },
        data: { replacedById: successor.id },
      });
      return true;
    }, serializableTransaction);
    if (!rotated) throw this.sessionRevoked();

    return {
      accessToken: await this.issueAccessToken(session.user),
      refreshToken,
      refreshExpiresAt,
      user: this.safeUser(session.user),
    };
  }

  async logout(rawToken: string | undefined, metadata: RequestMetadata): Promise<void> {
    if (!rawToken) return;
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.hashRefreshToken(rawToken) },
    });
    if (!session) return;
    await this.prisma.$transaction(async (database) => {
      await database.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorId: session.userId,
          action: 'AUTH_LOGOUT',
          entityType: 'User',
          entityId: session.userId,
          requestId: metadata.requestId,
        },
        database,
      );
    });
  }

  async requestPasswordReset(emailInput: string, metadata: RequestMetadata): Promise<void> {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true, deletedAt: null },
    });
    if (!user) return;
    const token = this.randomToken();
    await this.prisma.$transaction(async (database) => {
      await database.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await database.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.sha256(token),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      await this.audit.record(
        {
          actorId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'User',
          entityId: user.id,
          requestId: metadata.requestId,
        },
        database,
      );
    });
    await this.notifications.sendPasswordReset(user.email, token);
  }

  async confirmPasswordReset(
    token: string,
    password: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.sha256(token) },
      include: { user: true },
    });
    if (!reset || reset.consumedAt || reset.expiresAt <= new Date() || !reset.user.isActive) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'The reset link is invalid or expired.',
      });
    }
    this.passwords.validate(password, reset.user.email);
    const passwordHash = await this.passwords.hash(password);
    const changed = await this.prisma.$transaction(async (database) => {
      const consumed = await database.passwordResetToken.updateMany({
        where: { id: reset.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await database.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await database.refreshSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorId: reset.userId,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: reset.userId,
          requestId: metadata.requestId,
        },
        database,
      );
      return true;
    }, serializableTransaction);
    if (!changed) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'The reset link is invalid or expired.',
      });
    }
  }

  async acceptInvitation(
    token: string,
    password: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { tokenHash: this.sha256(token) },
      include: { user: true },
    });
    if (
      !invitation ||
      invitation.consumedAt ||
      invitation.expiresAt <= new Date() ||
      !invitation.user.isActive
    ) {
      throw new BadRequestException({
        code: 'INVITATION_INVALID',
        message: 'The invitation is invalid or expired.',
      });
    }
    this.passwords.validate(password, invitation.user.email);
    const passwordHash = await this.passwords.hash(password);
    const accepted = await this.prisma.$transaction(async (database) => {
      const consumed = await database.invitationToken.updateMany({
        where: { id: invitation.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await database.user.update({ where: { id: invitation.userId }, data: { passwordHash } });
      await this.audit.record(
        {
          actorId: invitation.userId,
          action: 'INVITATION_ACCEPTED',
          entityType: 'User',
          entityId: invitation.userId,
          requestId: metadata.requestId,
        },
        database,
      );
      return true;
    }, serializableTransaction);
    if (!accepted) {
      throw new BadRequestException({
        code: 'INVITATION_INVALID',
        message: 'The invitation is invalid or expired.',
      });
    }
  }

  async updateProfile(
    userId: string,
    name: string,
    metadata: RequestMetadata,
  ): Promise<AuthenticatedUser> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
    });
    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
      requestId: metadata.requestId,
      after: { name: updated.name },
    });
    return this.safeUser(updated);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw this.authenticationFailed();
    }
    if (await this.passwords.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException({
        code: 'PASSWORD_REUSE',
        message: 'Choose a different password.',
      });
    }
    this.passwords.validate(newPassword, user.email);
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (database) => {
      await database.user.update({ where: { id: userId }, data: { passwordHash } });
      await database.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorId: userId,
          action: 'PASSWORD_CHANGED',
          entityType: 'User',
          entityId: userId,
          requestId: metadata.requestId,
        },
        database,
      );
    });
  }

  private issueAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'access', jti: randomUUID() },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }),
      },
    );
  }

  private safeUser(user: Pick<User, 'id' | 'email' | 'name' | 'role'>): AuthenticatedUser {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLocaleLowerCase('en-US');
  }

  private randomToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private hashRefreshToken(value: string): string {
    return this.sha256(`${value}:${this.config.get('JWT_REFRESH_PEPPER', { infer: true })}`);
  }

  private refreshExpiry(): Date {
    const days = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private authenticationFailed(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTHENTICATION_FAILED',
      message: 'Email or password is incorrect.',
    });
  }

  private sessionRevoked(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'SESSION_REVOKED',
      message: 'The session is no longer valid.',
    });
  }
}
