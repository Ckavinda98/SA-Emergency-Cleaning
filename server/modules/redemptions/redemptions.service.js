import { prisma } from '../../db/prisma.js';
import { HttpError, badRequest, notFound } from '../../lib/httpError.js';
import { recordAudit } from '../../lib/audit.js';
import { organizationScope } from '../../lib/access.js';
import { getConfig } from '../config/config.service.js';
import { redemptionPoints } from '../../../shared/config.js';

export async function list(actor) {
  return prisma.redemptionRequest.findMany({
    where: organizationScope(actor),
    include: { organization: true, location: true },
    orderBy: { createdAt: 'desc' }
  });
}

// Points are worked out on the server from the configured rate, not trusted from the browser
export async function create(actor, { locationId, serviceCode, serviceName, quantity, organizationId: bodyOrgId }) {
  const organizationId = actor.role === 'CUSTOMER' ? actor.organizationId : bodyOrgId;
  const org = await prisma.organization.findUnique({ where: { id: organizationId || '__none__' } });
  if (!org) throw notFound('Organization account not found.');

  const location = await prisma.location.findFirst({ where: { id: locationId || '__none__', organizationId: org.id } });
  if (!location) throw badRequest('Please choose one of your own sites.');

  const config = await getConfig();
  const rate = (config.redemptionRates || []).find(r => r.code === serviceCode);
  if (!rate) throw badRequest('Unknown redemption service.');
  const calculatedPoints = redemptionPoints(rate, quantity);

  const minMonths = config.tenureMinMonths || 6;
  if (org.consecutiveMonths < minMonths) {
    throw badRequest(`Tenure Lock: Reward points redemptions unlock after ${minMonths} consecutive active membership months (Current Tenure: ${org.consecutiveMonths} month(s)).`);
  }
  if (org.pointsBalance < calculatedPoints) {
    throw badRequest(`Insufficient Points Balance: Required ${calculatedPoints} pts, Available ${org.pointsBalance} pts.`);
  }

  const redemption = await prisma.redemptionRequest.create({
    data: {
      organizationId: org.id,
      locationId: location.id,
      serviceCode,
      serviceName: serviceName || rate.name,
      quantity,
      calculatedPoints,
      status: 'PENDING_APPROVAL'
    }
  });

  await recordAudit(actor, {
    action: 'REDEMPTION_REQUESTED',
    entityType: 'RedemptionRequest',
    entityId: redemption.id,
    diff: { organizationId: org.id, serviceCode, quantity, calculatedPoints }
  });
  return { success: true, message: 'Redemption request submitted for Admin review.', redemption };
}

// Approve or reject. Only a PENDING request can be decided, so approving twice never deducts twice.
export async function decide(actor, id, status) {
  const redemption = await prisma.$transaction(async (tx) => {
    const current = await tx.redemptionRequest.findUnique({ where: { id } });
    if (!current) throw notFound('Redemption request not found');
    if (current.status !== 'PENDING_APPROVAL') throw new HttpError(409, `This request was already ${current.status}.`);

    if (status === 'APPROVED') {
      const org = await tx.organization.findUnique({ where: { id: current.organizationId } });
      if (org.pointsBalance < current.calculatedPoints) {
        throw badRequest(`Insufficient Points Balance: Required ${current.calculatedPoints} pts, Available ${org.pointsBalance} pts.`);
      }
    }
    // Conditional update: only succeeds while the request is still pending
    const changed = await tx.redemptionRequest.updateMany({ where: { id, status: 'PENDING_APPROVAL' }, data: { status } });
    if (changed.count !== 1) throw new HttpError(409, 'This request was already decided.');
    if (status === 'APPROVED') {
      await tx.organization.update({
        where: { id: current.organizationId },
        data: { pointsBalance: { decrement: current.calculatedPoints } }
      });
    }
    return { ...current, status };
  });

  await recordAudit(actor, {
    action: status === 'APPROVED' ? 'REDEMPTION_APPROVED' : 'REDEMPTION_REJECTED',
    entityType: 'RedemptionRequest',
    entityId: redemption.id,
    diff: { status: { from: 'PENDING_APPROVAL', to: status }, points: redemption.calculatedPoints }
  });
  return { success: true, message: `Redemption ${status} successfully.`, redemption };
}
