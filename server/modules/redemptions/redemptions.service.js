// Rewards (Agreement cl. 14): 1 point = $1 toward periodical services, against SACC's quoted price.
// The member asks for a service; SACC prices it and books it, and the points are deducted at booking.
// If SACC cancels a booked service, the points are given back.
import { prisma } from '../../db/prisma.js';
import { HttpError, badRequest, forbidden, notFound } from '../../lib/httpError.js';
import { recordAudit } from '../../lib/audit.js';
import { organizationScope, assertOrganizationAccess } from '../../lib/access.js';
import { getConfig } from '../config/config.service.js';
import { membershipSummary } from '../../lib/membership.js';
import { loyaltyLevel } from '../../../shared/membership.js';
import { creditPoints, spendPoints } from '../../lib/points.js';

export async function list(actor) {
  return prisma.redemptionRequest.findMany({
    where: organizationScope(actor),
    include: { organization: true, location: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function create(actor, { locationId, serviceCode, serviceName, quantity, notes, organizationId: bodyOrgId }) {
  const organizationId = actor.role === 'CUSTOMER' ? actor.organizationId : bodyOrgId;
  const org = await prisma.organization.findUnique({ where: { id: organizationId || '__none__' }, include: { locations: true } });
  if (!org) throw notFound('Organization account not found.');
  if (org.subscriptionStatus !== 'ACTIVE') throw badRequest('Rewards are available to active members only.');

  const location = org.locations.find(l => l.id === locationId);
  if (!location) throw badRequest('Please choose one of your own sites.');

  const config = await getConfig();
  const service = (config.redemptionServices || []).find(r => r.code === serviceCode);
  if (!service) throw badRequest('Please choose one of the eligible periodical services.');

  const summary = membershipSummary(org, config);
  if (!summary.redeemUnlocked) {
    throw badRequest(`Points can be used after ${config.tenureMinMonths ?? 6} consecutive months of membership (from ${new Date(summary.redeemUnlocksOn).toLocaleDateString('en-AU', { dateStyle: 'medium' })}).`);
  }
  if (org.pointsBalance <= 0) throw badRequest('You have no points to use yet.');

  const redemption = await prisma.redemptionRequest.create({
    data: {
      organizationId: org.id,
      locationId: location.id,
      serviceCode,
      serviceName: serviceName || service.name,
      quantity: Number(quantity) || 0,
      notes: notes ? String(notes).slice(0, 1000) : null,
      calculatedPoints: 0,
      status: 'PENDING_APPROVAL'
    }
  });

  await recordAudit(actor, {
    action: 'REDEMPTION_REQUESTED',
    entityType: 'RedemptionRequest',
    entityId: redemption.id,
    diff: { organizationId: org.id, serviceCode, quantity: redemption.quantity, notes: redemption.notes }
  });
  return { success: true, message: 'Request sent. SACC will quote the service and book it, using your points.', redemption };
}

// APPROVED = priced and booked: points deducted now (up to the price), any balance invoiced.
// REJECTED = not booked, nothing deducted. CANCELLED = withdrawn; points given back if they were deducted.
export async function decide(actor, id, { status, quoteAmount, scheduledFor }) {
  const config = await getConfig();
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.redemptionRequest.findUnique({ where: { id } });
    if (!current) throw notFound('Redemption request not found');
    assertOrganizationAccess(actor, current.organizationId);
    if (actor.role === 'CUSTOMER' && !(status === 'CANCELLED' && current.status === 'PENDING_APPROVAL')) throw forbidden('Only SACC can price or book a service.');

    if (status === 'CANCELLED') {
      if (!['PENDING_APPROVAL', 'APPROVED'].includes(current.status)) throw new HttpError(409, `This request was already ${current.status}.`);
      if (current.status === 'APPROVED' && current.calculatedPoints) {
        await creditPoints(tx, current.organizationId, current.calculatedPoints, 'REDEMPTION_RESTORED', `${current.serviceName} cancelled by SACC`, config);
      }
      await tx.redemptionRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
      return { ...current, status: 'CANCELLED' };
    }

    if (current.status !== 'PENDING_APPROVAL') throw new HttpError(409, `This request was already ${current.status}.`);
    const changed = await tx.redemptionRequest.updateMany({ where: { id, status: 'PENDING_APPROVAL' }, data: { status } });
    if (changed.count !== 1) throw new HttpError(409, 'This request was already decided.');
    if (status === 'REJECTED') return { ...current, status };

    const price = parseFloat(quoteAmount);
    if (!(price > 0)) throw badRequest('Enter the price of the service (ex GST).');
    const org = await tx.organization.findUnique({ where: { id: current.organizationId } });
    const level = loyaltyLevel(org.activationDate, new Date(), config);
    // Silver and Gold members get 5% off periodical services (cl. 15)
    const discountPercent = ['silver', 'gold'].includes(level?.id) ? (config.loyaltyLevels.find(l => l.id === 'silver')?.discountPercent ?? 5) : 0;
    const discounted = Math.round(price * (100 - discountPercent)) / 100;
    const points = Math.min(org.pointsBalance, Math.floor(discounted));
    if (points <= 0) throw badRequest('The member has no points to apply.');
    await spendPoints(tx, org.id, points, 'REDEMPTION', current.serviceName);
    const balanceDue = Math.round((discounted - points) * 100) / 100;
    if (balanceDue > 0) {
      const count = await tx.invoice.count();
      await tx.invoice.create({
        data: {
          invoiceNumber: `INV-${new Date().getFullYear()}-${1000 + count + 1}`, organizationId: org.id, kind: 'REDEMPTION',
          description: `${current.serviceName}: balance after ${points} reward points`, amount: balanceDue,
          gst: Math.round(balanceDue * (config.gstRate ?? 0.1) * 100) / 100, status: 'PENDING', paymentMethod: org.paymentMethod,
          dueDate: new Date(Date.now() + (config.extrasPaymentTermsDays ?? 7) * 86400000), paidAt: null
        }
      });
    }
    const data = { quoteAmount: price, discountPercent, calculatedPoints: points, balanceDue, scheduledFor: scheduledFor ? new Date(scheduledFor) : null };
    await tx.redemptionRequest.update({ where: { id }, data });
    return { ...current, ...data, status };
  });

  await recordAudit(actor, {
    action: { APPROVED: 'REDEMPTION_APPROVED', REJECTED: 'REDEMPTION_REJECTED', CANCELLED: 'REDEMPTION_CANCELLED' }[status],
    entityType: 'RedemptionRequest',
    entityId: result.id,
    diff: { status: { to: status }, points: result.calculatedPoints, quoteAmount: result.quoteAmount, balanceDue: result.balanceDue }
  });
  const message = status === 'APPROVED'
    ? `Booked: ${result.calculatedPoints} points applied${result.balanceDue ? `, $${result.balanceDue.toFixed(2)} + GST to pay` : ''}.`
    : `Request ${status.toLowerCase()}.`;
  return { success: true, message, redemption: result };
}
