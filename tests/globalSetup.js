// Rebuilds the TEST database from schema.prisma and fills it with the demo data before every test run.
// It uses TEST_DATABASE_URL (a Neon "test" branch or a local Postgres database), never DATABASE_URL,
// because everything in it is deleted each time.
import dotenv from 'dotenv';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

dotenv.config({ quiet: true });

export default function setup() {
  const root = resolve(import.meta.dirname, '..');
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Set TEST_DATABASE_URL in .env before running npm test (see docs/hosting/02-database-neon.md).');
  if (url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL must be a different database from DATABASE_URL: the tests delete everything in it.');

  const env = { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url, SACC_DB_URL: url, SEED_PASSWORD: 'Password123!' };
  execSync('npx prisma db push --force-reset --skip-generate --accept-data-loss', { cwd: root, stdio: 'pipe', env });
  execSync('node prisma/seed.js', { cwd: root, stdio: 'pipe', env });
}
