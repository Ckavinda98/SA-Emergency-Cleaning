import { PrismaClient } from '@prisma/client';

// One shared database client for the whole API.
// SACC_DB_URL points it at another SQLite file (the automated tests use prisma/test.db).
export const prisma = process.env.SACC_DB_URL
  ? new PrismaClient({ datasources: { db: { url: process.env.SACC_DB_URL } } })
  : new PrismaClient();
