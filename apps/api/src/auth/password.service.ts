import { BadRequestException, Injectable } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';

const commonPasswords = new Set([
  'password123!',
  'qwerty123456!',
  'consultflow123!',
  'administrator1!',
]);

@Injectable()
export class PasswordService {
  validate(password: string, email?: string): void {
    const normalized = password.toLocaleLowerCase('en-US');
    const emailPrefix = email?.split('@')[0]?.toLocaleLowerCase('en-US');
    const valid =
      password.length >= 12 &&
      password.length <= 128 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password) &&
      !commonPasswords.has(normalized) &&
      !(emailPrefix && emailPrefix.length >= 4 && normalized.includes(emailPrefix));
    if (!valid) {
      throw new BadRequestException({
        code: 'PASSWORD_POLICY_FAILED',
        message:
          'Use 12?128 characters with upper/lowercase, number, symbol, and no personal/common phrase.',
      });
    }
  }

  async hash(password: string): Promise<string> {
    return hash(password, {
      type: argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    }) as Promise<string>;
  }

  async verify(encodedHash: string, password: string): Promise<boolean> {
    return verify(encodedHash, password);
  }
}
