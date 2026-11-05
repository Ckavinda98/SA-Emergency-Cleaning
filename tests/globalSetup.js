// Builds a fresh test database (prisma/test.db) from schema.prisma and fills it with the demo data.
// Your real prisma/dev.db is never touched.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

export default function setup() {
  const root = resolve(import.meta.dirname, '..');
  const dbFile = resolve(root, 'prisma', 'test.db');
  const url = `file:${dbFile}`;
  const tmpSchema = resolve(root, 'prisma', 'schema.test.prisma');

  rmSync(dbFile, { force: true });
  const schema = readFileSync(resolve(root, 'prisma', 'schema.prisma'), 'utf8')
    .replace(/url\s*=\s*"file:\.\/dev\.db"/, `url = "${url}"`);
  writeFileSync(tmpSchema, schema);
  try {
    execSync(`npx prisma db push --schema "${tmpSchema}" --skip-generate --accept-data-loss`, { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(tmpSchema, { force: true });
  }
  execSync('node prisma/seed.js', { cwd: root, stdio: 'pipe', env: { ...process.env, SACC_DB_URL: url } });
}
