import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ApplicationThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const ip = typeof request.ip === 'string' ? request.ip : 'unknown';
    const body =
      typeof request.body === 'object' && request.body !== null
        ? (request.body as Record<string, unknown>)
        : undefined;
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLocaleLowerCase('en-US') : '';
    const identity = email ? createHash('sha256').update(email).digest('hex') : 'anonymous';
    return Promise.resolve(`${ip}:${identity}`);
  }
}
