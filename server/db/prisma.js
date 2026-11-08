import { PrismaClient } from '@prisma/client';
import '../config/loadEnv.js';

// One shared database client for the whole API. Prisma reads DATABASE_URL by itself.
// SACC_DB_URL points it at another database (the automated tests use TEST_DATABASE_URL).
export const prisma = process.env.SACC_DB_URL
  ? new PrismaClient({ datasources: { db: { url: process.env.SACC_DB_URL } } })
  : new PrismaClient();
