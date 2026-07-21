import { z } from 'zod';

const productionSecret = z.string().min(32);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_PEPPER: z.string().min(32),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(10_000).default(5),
    GLOBAL_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(120),
    APP_TIMEZONE: z.string().default('America/Mexico_City'),
    NO_ACTIVITY_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    RENEWAL_WINDOW_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SWAGGER_ENABLED: z.string().optional(),
    EMAIL_PROVIDER: z.enum(['console', 'ses']).default('console'),
    EMAIL_FROM: z.string().email().default('noreply@consultflow.local'),
    APP_BASE_URL: z.string().url().default('http://localhost:5173'),
    AWS_REGION: z.string().default('us-east-1'),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== 'production') return;
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_PEPPER'] as const) {
      if (
        !productionSecret.safeParse(value[key]).success ||
        /change|example|dev/i.test(value[key])
      ) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'must be a strong production secret',
        });
      }
    }
    if (value.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'wildcards are forbidden',
      });
    }
    if (value.EMAIL_PROVIDER !== 'ses') {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDER'],
        message: 'production requires the SES provider',
      });
    }
  });

export type Environment = z.infer<typeof schema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid application configuration: ${fields}`);
  }
  return result.data;
}
