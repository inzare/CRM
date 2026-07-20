import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with Argon2id and verifies the credential', async () => {
    const encoded = await service.hash('A-strong-local-pass9!');
    expect(encoded).toMatch(/^\$argon2id\$/);
    await expect(service.verify(encoded, 'A-strong-local-pass9!')).resolves.toBe(true);
    await expect(service.verify(encoded, 'wrong')).resolves.toBe(false);
  });

  it.each(['shortA1!', 'alllowercase123!', 'ALLUPPERCASE123!', 'NoSymbols1234'])(
    'rejects weak password %s',
    (password) => {
      expect(() => service.validate(password)).toThrow(BadRequestException);
    },
  );

  it('rejects a password containing the email identity', () => {
    expect(() => service.validate('Administrator-2026!', 'administrator@example.com')).toThrow(
      BadRequestException,
    );
  });
});
