import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { AuditController } from '../audit/audit.controller';
import { AssigneesController, UsersController } from '../users/users.controller';

import { AccessTokenGuard } from './access-token.guard';
import { MeController } from './auth.controller';

describe('protected controller architecture', () => {
  it.each([MeController, UsersController, AssigneesController, AuditController])(
    '%s requires the access-token guard',
    (controller) => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[] | undefined;
      expect(guards).toContain(AccessTokenGuard);
    },
  );
});
