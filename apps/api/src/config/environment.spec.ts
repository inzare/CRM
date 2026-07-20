import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './environment';

const valid = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/consultflow',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_PEPPER: 'b'.repeat(40),
};

describe('validateEnvironment', () => {
  it('applies safe local defaults', () => {
    const environment = validateEnvironment(valid);
    expect(environment.PORT).toBe(3000);
    expect(environment.CORS_ORIGINS).toBe('http://localhost:5173');
    expect(environment.ACCESS_TOKEN_TTL).toBe('15m');
  });

  it('fails closed on production placeholder secrets', () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'change-this-example-secret-change-this',
      }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('rejects wildcard production CORS', () => {
    expect(() =>
      validateEnvironment({ ...valid, NODE_ENV: 'production', CORS_ORIGINS: '*' }),
    ).toThrow('CORS_ORIGINS');
  });
});
