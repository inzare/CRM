import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const supplied = request.header('x-request-id');
  const requestId = supplied && /^[a-zA-Z0-9._-]{8,128}$/.test(supplied) ? supplied : randomUUID();
  request.id = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}

declare global {
  // Express exposes request augmentation through its namespace declaration.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}
