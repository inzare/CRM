import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { throwMappedPrismaError } from './prisma-errors';

describe('throwMappedPrismaError', () => {
  it('maps unique races to safe conflict errors', () => {
    expect(() =>
      throwMappedPrismaError({ code: 'P2002', meta: { target: 'secret_column' } }),
    ).toThrow(ConflictException);
  });

  it('maps missing mutations to safe not found errors', () => {
    expect(() => throwMappedPrismaError({ code: 'P2025' })).toThrow(NotFoundException);
  });

  it('preserves unknown errors for central handling', () => {
    const error = new Error('unknown');
    expect(() => throwMappedPrismaError(error)).toThrow(error);
  });
});
