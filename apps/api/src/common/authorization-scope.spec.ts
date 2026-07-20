import { describe, expect, it } from 'vitest';

import { Role } from '../generated/prisma/client';

import { canManageAllRecords, ownerScope } from './authorization-scope';

describe('authorization scopes', () => {
  it.each([Role.ADMIN, Role.MANAGER])('gives %s organization scope', (role) => {
    const actor = { id: 'actor', role };
    expect(ownerScope(actor)).toEqual({});
    expect(canManageAllRecords(actor)).toBe(true);
  });

  it.each([Role.SALES, Role.CONSULTANT])(
    'restricts %s to actor-owned records by default',
    (role) => {
      const actor = { id: 'actor', role };
      expect(ownerScope(actor)).toEqual({ ownerId: 'actor' });
      expect(canManageAllRecords(actor)).toBe(false);
    },
  );
});
