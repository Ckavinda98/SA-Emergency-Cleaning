import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

dotenv.config({ quiet: true }); // TEST_DATABASE_URL comes from .env

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@shared': resolve(import.meta.dirname, 'shared')
    }
  },
  test: {
    globalSetup: ['tests/globalSetup.js'],
    env: { SACC_DB_URL: process.env.TEST_DATABASE_URL || '', STORAGE_DRIVER: 'inline' },
    include: ['tests/**/*.test.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    fileParallelism: false,
    testTimeout: 20000
  }
});
