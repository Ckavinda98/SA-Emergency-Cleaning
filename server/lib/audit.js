import { prisma } from '../db/prisma.js';

// CHANGE HISTORY (AuditLog table). Logging must never break the request itself.
export async function recordAudit(actor, { action, entityType, entityId = null, diff = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor?.userId || null,
        userEmail: actor?.email || null,
        userRole: actor?.role || null,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        diffJson: diff ? JSON.stringify(diff) : null,
        ipAddress: actor?.ip || null
      }
    });
  } catch (error) {
    console.warn('AuditLog write failed:', error.message);
  }
}

// Field-by-field before/after for the fields that actually changed
export function changedFields(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    const a = after[field] instanceof Date ? after[field].toISOString() : after[field];
    const b = before[field] instanceof Date ? before[field].toISOString() : before[field];
    if (a !== undefined && a !== b) changes[field] = { from: b ?? null, to: a ?? null };
  }
  return changes;
}
