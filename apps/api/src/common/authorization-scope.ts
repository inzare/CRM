import { Role } from '../generated/prisma/client';

export interface AuthenticatedActor {
  id: string;
  role: Role;
}

export function ownerScope(actor: AuthenticatedActor): Record<string, never> | { ownerId: string } {
  if (actor.role === Role.ADMIN || actor.role === Role.MANAGER) return {};
  return { ownerId: actor.id };
}

export function canManageAllRecords(actor: AuthenticatedActor): boolean {
  return actor.role === Role.ADMIN || actor.role === Role.MANAGER;
}
