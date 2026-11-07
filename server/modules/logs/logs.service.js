import { prisma } from '../../db/prisma.js';
import { notFound } from '../../lib/httpError.js';
import { ACTIONS, actionInfo, ENTITIES, ROLE_NAMES, fieldLabel } from '../../../shared/activity.js';

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

/* ------------------------------------------------------------------ Activity log (readable change history) */

const parse = (json) => { try { return json ? JSON.parse(json) : null; } catch { return null; } };

// Turns nested settings into "path -> value" so before/after can be compared field by field
function flatten(value, prefix = '', out = {}) {
  if (Array.isArray(value)) {
    if (value.every(v => v === null || typeof v !== 'object')) { out[prefix] = value.join(', '); return out; }
    value.forEach((v, i) => flatten(v, `${prefix}.${v?.id || v?.code || i}`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else out[prefix] = value;
  return out;
}

const show = (v) => (v === null || v === undefined || v === '' ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));

// Every diff becomes { changes: [{ field, label, from, to }], values: [{ field, label, value }] }
export function describeDiff(diff) {
  const changes = [], values = [];
  if (!diff || typeof diff !== 'object') return { changes, values };
  if (diff.before !== undefined && diff.after !== undefined) {
    const a = flatten(diff.before), b = flatten(diff.after);
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (show(a[key]) !== show(b[key])) changes.push({ field: key, label: fieldLabel(key), from: show(a[key]), to: show(b[key]) });
    }
    return { changes, values };
  }
  for (const [key, v] of Object.entries(diff)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && ('from' in v || 'to' in v)) {
      changes.push({ field: key, label: fieldLabel(key), from: show(v.from), to: show(v.to) });
    } else {
      values.push({ field: key, label: fieldLabel(key), value: key === 'password' ? 'changed' : show(v) });
    }
  }
  return { changes, values };
}

// Names for the records and people in a page of log rows (a few small look-ups, not one per row)
async function namesFor(logs) {
  const ids = (type) => [...new Set(logs.filter(l => l.entityType === type && l.entityId).map(l => l.entityId))];
  const [orgs, sites, jobs, techs, rewards, invoices, users] = await Promise.all([
    prisma.organization.findMany({ where: { id: { in: ids('Organization') } }, select: { id: true, businessName: true } }),
    prisma.location.findMany({ where: { id: { in: ids('Location') } }, select: { id: true, name: true, organizationId: true, organization: { select: { businessName: true } } } }),
    prisma.emergencyRequest.findMany({ where: { id: { in: ids('EmergencyRequest') } }, select: { id: true, jobNumber: true, customerName: true } }),
    prisma.technician.findMany({ where: { id: { in: ids('Technician') } }, select: { id: true, name: true } }),
    prisma.redemptionRequest.findMany({ where: { id: { in: ids('RedemptionRequest') } }, select: { id: true, serviceName: true, organizationId: true } }),
    prisma.invoice.findMany({ where: { id: { in: ids('Invoice') } }, select: { id: true, invoiceNumber: true, organizationId: true } }),
    prisma.user.findMany({ where: { id: { in: [...new Set(logs.map(l => l.userId).filter(Boolean))] } }, select: { id: true, name: true } })
  ]);
  const byId = (rows, f) => Object.fromEntries(rows.map(r => [r.id, f(r)]));
  return {
    Organization: byId(orgs, r => ({ label: r.businessName, organizationId: r.id })),
    Location: byId(sites, r => ({ label: `${r.name}${r.organization ? ` (${r.organization.businessName})` : ''}`, organizationId: r.organizationId })),
    EmergencyRequest: byId(jobs, r => ({ label: `${r.jobNumber}${r.customerName ? ` · ${r.customerName}` : ''}` })),
    Technician: byId(techs, r => ({ label: r.name })),
    RedemptionRequest: byId(rewards, r => ({ label: r.serviceName, organizationId: r.organizationId })),
    Invoice: byId(invoices, r => ({ label: r.invoiceNumber, organizationId: r.organizationId })),
    users: byId(users, r => r.name)
  };
}

function toActivity(log, names, { detail = false } = {}) {
  const diff = parse(log.diffJson);
  const info = actionInfo(log.action);
  const found = names[log.entityType]?.[log.entityId];
  // A deleted record is gone, so fall back to the name saved in the log itself
  const savedName = diff && (diff.businessName || diff.name || diff.jobNumber || diff.serviceName);
  const { changes, values } = describeDiff(diff);
  const row = {
    id: log.id,
    at: log.createdAt,
    action: log.action,
    actionLabel: info.label,
    kind: info.kind,
    entityType: log.entityType,
    entityTypeLabel: ENTITIES[log.entityType] || log.entityType,
    entityId: log.entityId,
    entityLabel: found?.label || (typeof savedName === 'string' ? savedName : null) || (log.entityType === 'SystemDynamicConfig' ? 'Pricing and rules' : null),
    entityExists: Boolean(found),
    organizationId: found?.organizationId || null,
    user: { id: log.userId, name: names.users[log.userId] || null, email: log.userEmail, role: log.userRole, roleLabel: ROLE_NAMES[log.userRole] || log.userRole || 'System' },
    summary: changes.length ? changes.slice(0, 3).map(c => c.label).join(', ') + (changes.length > 3 ? ` and ${changes.length - 3} more` : '') : values.slice(0, 3).map(v => v.label).join(', '),
    changeCount: changes.length
  };
  if (detail) Object.assign(row, { changes, values, ipAddress: log.ipAddress });
  return row;
}

const KIND_ACTIONS = (kind) => Object.entries(ACTIONS).filter(([, v]) => v.kind === kind).map(([k]) => k);

// GET /api/activity?role=&kind=&entityType=&q=&from=&to=&page=
export async function activity(query) {
  const where = {};
  if (query.role) where.userRole = String(query.role).toUpperCase();
  if (query.kind) where.action = { in: KIND_ACTIONS(String(query.kind)) };
  if (query.entityType) where.entityType = String(query.entityType);
  if (query.entityId) where.entityId = String(query.entityId);
  if (query.userId) where.userId = String(query.userId);
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(`${query.from}T00:00:00`);
    if (query.to) where.createdAt.lte = new Date(`${query.to}T23:59:59.999`);
  }
  const q = String(query.q || '').trim();
  if (q) {
    // Names, emails and values typed in the change itself; also matches action names ("plan", "deleted")
    const actionHits = Object.entries(ACTIONS).filter(([k, v]) => `${k} ${v.label}`.toLowerCase().includes(q.toLowerCase())).map(([k]) => k);
    const [orgs, techs, jobs, users] = await Promise.all([
      prisma.organization.findMany({ where: { businessName: { contains: q } }, select: { id: true } }),
      prisma.technician.findMany({ where: { name: { contains: q } }, select: { id: true } }),
      prisma.emergencyRequest.findMany({ where: { jobNumber: { contains: q } }, select: { id: true } }),
      prisma.user.findMany({ where: { name: { contains: q } }, select: { id: true } })
    ]);
    const entityIds = [...orgs, ...techs, ...jobs].map(r => r.id);
    where.OR = [
      { userEmail: { contains: q } },
      { diffJson: { contains: q } },
      ...(actionHits.length ? [{ action: { in: actionHits } }] : []),
      ...(entityIds.length ? [{ entityId: { in: entityIds } }] : []),
      ...(users.length ? [{ userId: { in: users.map(u => u.id) } }] : [])
    ];
  }
  const pageSize = Math.min(parseInt(query.pageSize, 10) || 25, 100);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
  ]);
  const names = await namesFor(logs);
  return { items: logs.map(l => toActivity(l, names)), total, page, pageSize };
}

// GET /api/activity/:id: one change with every field before and after
export async function activityDetail(id) {
  const log = await prisma.auditLog.findUnique({ where: { id } });
  if (!log) throw notFound('Activity not found');
  const names = await namesFor([log]);
  return toActivity(log, names, { detail: true });
}
