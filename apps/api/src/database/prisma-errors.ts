import { ConflictException, NotFoundException } from '@nestjs/common';

interface PrismaLikeError {
  code?: unknown;
  meta?: unknown;
}

function isPrismaLikeError(error: unknown): error is PrismaLikeError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export function throwMappedPrismaError(error: unknown): never {
  if (isPrismaLikeError(error) && error.code === 'P2002') {
    throw new ConflictException({
      code: 'RESOURCE_CONFLICT',
      message: 'A unique value is already in use.',
    });
  }
  if (isPrismaLikeError(error) && error.code === 'P2025') {
    throw new NotFoundException({
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource was not found.',
    });
  }
  throw error;
}
