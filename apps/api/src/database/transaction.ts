import { Prisma } from '../generated/prisma/client';

export const serializableTransaction = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 10_000,
} as const;
