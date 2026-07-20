import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';

import type { AccessPayload } from './auth.types';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.header('authorization')?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw this.unauthorized('AUTHENTICATION_REQUIRED');
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      if (payload.type !== 'access') throw new Error('Unexpected token type');
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, isActive: true, deletedAt: null },
        select: { id: true, email: true, name: true, role: true },
      });
      if (!user) throw new Error('Inactive user');
      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw this.unauthorized('ACCESS_TOKEN_INVALID');
    }
  }

  private unauthorized(code: string): UnauthorizedException {
    return new UnauthorizedException({ code, message: 'Authentication is required.' });
  }
}
