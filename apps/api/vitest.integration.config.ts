import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.integration.ts'],
    setupFiles: ['reflect-metadata'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
