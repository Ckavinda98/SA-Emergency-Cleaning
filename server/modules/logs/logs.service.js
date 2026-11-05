import { prisma } from '../../db/prisma.js';

const limitOf = (query) => Math.min(parseInt(query.limit, 10) || 100, 500);

export async function loginLogs(query) {
  const where = {};
  if (query.email) where.email = String(query.email).toLowerCase();
  if (query.event) where.event = String(query.event);
  return prisma.loginLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limitOf(query) });
}

export async function auditLogs(query) {
  const where = {};
  if (query.entityType) where.entityType = String(query.entityType);
  if (query.entityId) where.entityId = String(query.entityId);
  if (query.userId) where.userId = String(query.userId);
  const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limitOf(query) });
  return logs.map(l => ({ ...l, diff: l.diffJson ? JSON.parse(l.diffJson) : null }));
}
