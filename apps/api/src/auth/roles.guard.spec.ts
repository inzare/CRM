import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { Role } from '../generated/prisma/client';

import { RolesGuard } from './roles.guard';

function context(role: Role) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as never;
}

describe('RolesGuard', () => {
  it('allows a declared role', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(context(Role.ADMIN))).toBe(true);
  });

  it('denies a role outside the declaration', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    expect(() => new RolesGuard(reflector).canActivate(context(Role.SALES))).toThrow(
      ForbiddenException,
    );
  });
});
