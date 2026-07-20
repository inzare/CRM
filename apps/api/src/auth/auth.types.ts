import type { Role } from '../generated/prisma/client';

export interface AccessPayload {
  sub: string;
  email: string;
  role: Role;
  type: 'access';
  jti: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface RequestMetadata {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}
