import { defineConfig, devices } from '@playwright/test';

const e2eDatabaseUrl = process.env.DATABASE_URL ?? '';
let e2eDatabaseName = '';
try {
  e2eDatabaseName = new URL(e2eDatabaseUrl).pathname.replace(/^\//, '');
} catch {
  // The explicit error below provides one deterministic setup message.
}
if (!e2eDatabaseName.toLowerCase().includes('test')) {
  throw new Error('Playwright requires DATABASE_URL to name an isolated test database.');
}

const apiEnvironment = {
  NODE_ENV: 'development',
  PORT: '3100',
  DATABASE_URL: e2eDatabaseUrl,
  JWT_ACCESS_SECRET: 'e2e-access-secret-with-at-least-thirty-two-characters',
  JWT_REFRESH_PEPPER: 'e2e-refresh-pepper-with-at-least-thirty-two-characters',
  CORS_ORIGINS: 'http://127.0.0.1:5173',
  EMAIL_PROVIDER: 'console',
  EMAIL_FROM: 'e2e@consultflow.local',
  APP_BASE_URL: 'http://127.0.0.1:5173',
  SWAGGER_ENABLED: 'true',
  LOGIN_RATE_LIMIT: '100',
};
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'npm run db:seed && npm run build -w @consultflow/api && npm run start -w @consultflow/api',
      url: 'http://127.0.0.1:3100/api/v1/health/live',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: apiEnvironment,
    },
    {
      command: 'npm run dev -w @consultflow/web -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3100' },
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
