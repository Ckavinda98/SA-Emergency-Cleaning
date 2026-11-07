// Reward points ledger (Agreement cl. 14). Every change is a PointsEntry row; Organization.pointsBalance
// is kept equal to the sum so pages can read it quickly. Spending uses the oldest points first,
// so the points that expire (12 months after they were earned, cl. 14.5) are the ones not yet used.
import { addMonths } from '../../shared/membership.js';

export async function creditPoints(tx, organizationId, points, reason, note, config, at = new Date()) {
  if (!points) return null;
  const expiresAt = addMonths(at, config?.pointsExpiryMonths ?? 12);
  const entry = await tx.pointsEntry.create({ data: { organizationId, points, remaining: points, reason, note, expiresAt, createdAt: at } });
  await tx.organization.update({ where: { id: organizationId }, data: { pointsBalance: { increment: points } } });
  return entry;
}

// Takes points from the oldest unexpired earned entries. Throws when the balance is short.
export async function spendPoints(tx, organizationId, points, reason, note, at = new Date()) {
  if (!points) return null;
  const org = await tx.organization.findUnique({ where: { id: organizationId } });
  if ((org?.pointsBalance || 0) < points) {
    const err = new Error(`Not enough points: ${points} needed, ${org?.pointsBalance || 0} available.`);
    err.status = 400;
    throw err;
  }
  await drainOldest(tx, organizationId, points, at);
  const entry = await tx.pointsEntry.create({ data: { organizationId, points: -points, reason, note, createdAt: at } });
  await tx.organization.update({ where: { id: organizationId }, data: { pointsBalance: { decrement: points } } });
  return entry;
}

async function drainOldest(tx, organizationId, points, at) {
  let left = points;
  const lots = await tx.pointsEntry.findMany({
    where: { organizationId, remaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: at } }] },
    orderBy: { createdAt: 'asc' }
  });
  for (const lot of lots) {
    if (!left) break;
    const take = Math.min(lot.remaining, left);
    await tx.pointsEntry.update({ where: { id: lot.id }, data: { remaining: lot.remaining - take } });
    left -= take;
  }
}

// Points older than 12 months that were never spent (cl. 14.5)
export async function expirePoints(tx, at = new Date()) {
  const lots = await tx.pointsEntry.findMany({ where: { remaining: { gt: 0 }, expiresAt: { lte: at } } });
  for (const lot of lots) {
    await tx.pointsEntry.update({ where: { id: lot.id }, data: { remaining: 0 } });
    await tx.pointsEntry.create({ data: { organizationId: lot.organizationId, points: -lot.remaining, reason: 'EXPIRED', note: `Earned ${lot.createdAt.toISOString().slice(0, 10)}`, createdAt: at } });
    await tx.organization.update({ where: { id: lot.organizationId }, data: { pointsBalance: { decrement: lot.remaining } } });
  }
  return lots.length;
}

// Cancellation (cl. 5.3, 14.6): every point is cancelled
export async function cancelAllPoints(tx, organizationId, at = new Date()) {
  const org = await tx.organization.findUnique({ where: { id: organizationId } });
  if (!org?.pointsBalance) return 0;
  await tx.pointsEntry.updateMany({ where: { organizationId, remaining: { gt: 0 } }, data: { remaining: 0 } });
  await tx.pointsEntry.create({ data: { organizationId, points: -org.pointsBalance, reason: 'CANCELLED', note: 'Membership cancelled', createdAt: at } });
  await tx.organization.update({ where: { id: organizationId }, data: { pointsBalance: 0 } });
  return org.pointsBalance;
}
