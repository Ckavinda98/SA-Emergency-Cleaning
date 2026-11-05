import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@shared': resolve(import.meta.dirname, 'shared')
    }
  },
  test: {
    globalSetup: ['tests/globalSetup.js'],
    env: { SACC_DB_URL: `file:${resolve(import.meta.dirname, 'prisma', 'test.db')}` },
    include: ['tests/**/*.test.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    fileParallelism: false,
    testTimeout: 20000
  }
});
