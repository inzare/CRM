import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../database/prisma.service';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports liveness without a dependency check', () => {
    const controller = new HealthController({} as PrismaService);
    expect(controller.live().status).toBe('ok');
  });

  it('reports readiness when PostgreSQL responds', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.ready()).resolves.toMatchObject({ status: 'ok' });
  });

  it('fails readiness safely when PostgreSQL is unavailable', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('secret connection detail')) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
