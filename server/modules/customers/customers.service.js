import { prisma } from '../../db/prisma.js';
import { badRequest, notFound } from '../../lib/httpError.js';
import { recordAudit, changedFields } from '../../lib/audit.js';
import { assertOrganizationAccess, jobScope } from '../../lib/access.js';
import { hashPassword, generateTempPassword } from '../../lib/passwords.js';
import { isAdelaideLocation, ADELAIDE_ERROR } from '../../../shared/location.js';
import { serviceArea, proRata, billingPeriod } from '../../../shared/membership.js';
import { PLAN_IDS } from '../../../shared/config.js';
import { getConfig } from '../config/config.service.js';
import { withMembership, membershipSummary, newMemberFields, recordMembershipPayment, lockRates } from '../../lib/membership.js';
import { creditPoints, cancelAllPoints } from '../../lib/points.js';

// Site fields worked out from the address (cl. 18): outside-metro sites wait for SACC approval
export function areaFields(address, config) {
  const area = serviceArea(address, config);
  return { serviceArea: area === 'METRO' ? 'METRO' : 'OUTSIDE_METRO', areaApproved: area === 'METRO' };
}

async function findOrganization(id) {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) throw notFound('Customer not found');
  return org;
}

// A customer only receives their own company
export async function list(actor) {
  let where = actor.role === 'CUSTOMER' ? { id: actor.organizationId || '__none__' } : {};
  // A technician only needs the companies they have jobs for
  if (actor.role === 'TECHNICIAN') {
    const jobs = await prisma.emergencyRequest.findMany({ where: await jobScope(actor), select: { organizationId: true } });
    where = { id: { in: [...new Set(jobs.map(j => j.organizationId))] } };
  }
  const [orgs, config] = await Promise.all([prisma.organization.findMany({ where, include: { locations: true }, orderBy: { createdAt: 'asc' } }), getConfig()]);
  return orgs.map(o => withMembership(o, config));
}

export async function get(actor, id) {
  assertOrganizationAccess(actor, id);
  const customer = await prisma.organization.findUnique({ where: { id }, include: { locations: true } });
  if (!customer) throw notFound('Customer not found');
  return withMembership(customer, await getConfig());
}

// Admin adds a company. The login gets a random temporary password, shown once to the admin.
export async function create(actor, body) {
  const { businessName, primaryContactName, phoneNumber, email } = body;
  if (body.address && !isAdelaideLocation(body.address)) throw badRequest(ADELAIDE_ERROR);

  const normEmail = email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email: normEmail } });
  const existingOrg = await prisma.organization.findUnique({ where: { email: normEmail } });
  if (existingUser || existingOrg) throw badRequest('An account with this email address already exists.');

  const tempPassword = body.password || generateTempPassword();
  const hashedPassword = await hashPassword(tempPassword);
  const config = await getConfig();
  const sites = Array.isArray(body.locations) && body.locations.length
    ? body.locations.map(l => ({
        name: l.name || 'Primary Site',
        address: l.address || body.address || 'Adelaide SA 5000',
        contactName: l.contactName || primaryContactName,
        contactPhone: l.contactPhone || phoneNumber,
        accessInstructions: l.accessInstructions || null,
        securityNotes: l.securityNotes || null,
        ...areaFields(l.address || body.address || 'Adelaide SA 5000', config)
      }))
    : [{
        name: 'Primary Site',
        address: body.address || 'Adelaide SA 5000',
        contactName: primaryContactName,
        contactPhone: phoneNumber,
        accessInstructions: 'Main Door Access Keypad',
        securityNotes: 'Standard Site',
        ...areaFields(body.address || 'Adelaide SA 5000', config)
      }];

  const customer = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        businessName: businessName.trim(),
        abn: body.abn,
        primaryContactName: primaryContactName.trim(),
        phoneNumber,
        email: normEmail,
        membershipPlan: body.membershipPlan || 'business',
        paymentMethod: body.paymentMethod || 'PayTo Bank Direct',
        ...(await newMemberFields(tx, config, body)),
        locations: { create: sites }
      },
      include: { locations: true }
    });
    await recordMembershipPayment(tx, org, config, { creditPoints });
    await tx.user.create({
      data: { email: normEmail, password: hashedPassword, name: primaryContactName.trim(), role: 'CUSTOMER', organizationId: org.id }
    });
    return org;
  });

  await recordAudit(actor, {
    action: 'CUSTOMER_CREATED',
    entityType: 'Organization',
    entityId: customer.id,
    diff: {
      businessName: customer.businessName, abn: customer.abn, primaryContactName: customer.primaryContactName,
      phoneNumber: customer.phoneNumber, email: normEmail, membershipPlan: customer.membershipPlan,
      sites: customer.locations.map(l => `${l.name}: ${l.address}`).join('; ')
    }
  });

  const fresh = await prisma.organization.findUnique({ where: { id: customer.id }, include: { locations: true } });
  return { ...withMembership(fresh, config), loginEmail: normEmail, tempPassword: body.password ? undefined : tempPassword };
}

export async function updateProfile(actor, id, body) {
  assertOrganizationAccess(actor, id);
  const { businessName, primaryContactName, phoneNumber, email, password } = body;
  const before = await findOrganization(id);
  const staff = actor.role === 'ADMIN' || actor.role === 'CONFIG';

  const updateData = {};
  if (businessName) updateData.businessName = businessName;
  if (primaryContactName) updateData.primaryContactName = primaryContactName;
  if (phoneNumber) updateData.phoneNumber = phoneNumber;
  if (email) updateData.email = email.trim().toLowerCase();
  // Only staff may correct the ABN; customers call the office for that
  const digits = (v) => String(v || '').replace(/\s/g, '');
  if (staff && body.abn && digits(body.abn) !== digits(before.abn)) updateData.abn = digits(body.abn);

  // The login account of this company: the signed-in customer, or the user with the company email
  const loginUser = actor.role === 'CUSTOMER'
    ? await prisma.user.findUnique({ where: { id: actor.userId } })
    : await prisma.user.findFirst({ where: { organizationId: id, email: before.email } });

  if (updateData.email && updateData.email !== before.email) {
    const taken = await prisma.user.findUnique({ where: { email: updateData.email } });
    if (taken && taken.id !== loginUser?.id) throw badRequest('An account with this email address already exists.');
  }

  if (staff && body.billingFrequency && ['MONTHLY', 'ANNUAL'].includes(body.billingFrequency) && body.billingFrequency !== before.billingFrequency) updateData.billingFrequency = body.billingFrequency;
  const customer = await prisma.$transaction(async (tx) => {
    const updated = await tx.organization.update({ where: { id }, data: updateData, include: { locations: true } });
    // The password and login email live on the User row, not on Organization
    if (loginUser) {
      const userData = {};
      if (password) userData.password = await hashPassword(password);
      if (updateData.email && loginUser.email === before.email) userData.email = updateData.email;
      if (primaryContactName && loginUser.email === before.email) userData.name = primaryContactName;
      if (Object.keys(userData).length) await tx.user.update({ where: { id: loginUser.id }, data: userData });
    }
    return updated;
  });

  const diff = changedFields(before, updateData, ['businessName', 'abn', 'primaryContactName', 'phoneNumber', 'email', 'billingFrequency']);
  if (password) diff.password = 'changed';
  await recordAudit(actor, { action: 'PROFILE_UPDATED', entityType: 'Organization', entityId: customer.id, diff });

  return { success: true, message: 'Profile updated successfully!', customer: withMembership(customer, await getConfig()) };
}

// Plan changes (cl. 6): upgrades apply now with the fee difference charged pro-rata;
// downgrades apply from the start of the next billing period.
export async function changePlan(actor, id, membershipPlan) {
  assertOrganizationAccess(actor, id);
  const config = await getConfig();
  const before = await prisma.organization.findUnique({ where: { id }, include: { locations: true } });
  if (!before) throw notFound('Customer not found');
  if (before.subscriptionStatus === 'CANCELLED') throw badRequest('This membership has been cancelled.');
  if (membershipPlan === before.membershipPlan) {
    if (!before.pendingPlan) throw badRequest('This is already the current plan.');
    // Keeping the current plan cancels a scheduled downgrade
    const customer = await prisma.organization.update({ where: { id }, data: { pendingPlan: null, pendingPlanFrom: null }, include: { locations: true } });
    await recordAudit(actor, { action: 'PLAN_CHANGED', entityType: 'Organization', entityId: id, diff: { pendingPlan: { from: before.pendingPlan, to: null } } });
    return { success: true, message: 'The scheduled plan change was cancelled.', customer: withMembership(customer, config) };
  }

  const now = new Date();
  const oldSummary = membershipSummary(before, config, now);
  const after = { ...before, membershipPlan, locations: before.locations };
  const newSummary = membershipSummary(after, config, now);
  const upgrade = newSummary.fee.monthly > oldSummary.fee.monthly;
  const period = billingPeriod(before.activationDate, before.billingFrequency, now);
  let message;

  const customer = await prisma.$transaction(async (tx) => {
    if (upgrade) {
      const difference = proRata(newSummary.periodFee - oldSummary.periodFee, period.start, period.end, now);
      if (difference > 0) {
        const count = await tx.invoice.count();
        await tx.invoice.create({
          data: {
            invoiceNumber: `INV-${now.getFullYear()}-${1000 + count + 1}`, organizationId: id, kind: 'MEMBERSHIP',
            description: `Upgrade to ${newSummary.planName}: pro-rata fee difference to ${period.end.toISOString().slice(0, 10)}`,
            amount: difference, gst: Math.round(difference * (config.gstRate ?? 0.1) * 100) / 100,
            status: 'PENDING', paymentMethod: before.paymentMethod, dueDate: new Date(now.getTime() + 7 * 86400000), paidAt: null
          }
        });
      }
      message = `Upgraded to ${newSummary.planName} from today.${difference > 0 ? ` A pro-rata charge of $${difference.toFixed(2)} + GST has been added.` : ''}`;
      // The higher plan's rates apply from the change date (cl. 6.2)
      return tx.organization.update({ where: { id }, data: { membershipPlan, pendingPlan: null, pendingPlanFrom: null, ...lockRates(config, before, now) }, include: { locations: true } });
    }
    message = `Your plan will change to ${newSummary.planName} on ${period.end.toLocaleDateString('en-AU', { timeZone: 'Australia/Adelaide', dateStyle: 'medium' })}, the start of your next billing period.`;
    return tx.organization.update({ where: { id }, data: { pendingPlan: membershipPlan, pendingPlanFrom: period.end }, include: { locations: true } });
  });

  await recordAudit(actor, {
    action: 'PLAN_CHANGED',
    entityType: 'Organization',
    entityId: customer.id,
    diff: upgrade
      ? { membershipPlan: { from: before.membershipPlan, to: membershipPlan }, change: 'Upgrade, effective now' }
      : { pendingPlan: { from: before.pendingPlan, to: membershipPlan }, change: `Downgrade from ${period.end.toISOString().slice(0, 10)}` }
  });
  return { success: true, upgrade, message, customer: withMembership(customer, config) };
}

// Cancellation (cl. 5.2, 5.3): only once 30 days have passed since the last call-out; pro-rata refund; points cancelled.
// SACC staff may cancel at any time (cl. 5.4).
export async function cancelSubscription(actor, id) {
  assertOrganizationAccess(actor, id);
  const config = await getConfig();
  const before = await prisma.organization.findUnique({ where: { id }, include: { locations: true } });
  if (!before) throw notFound('Customer not found');
  if (before.subscriptionStatus === 'CANCELLED') throw badRequest('This membership is already cancelled.');
  const now = new Date();
  const summary = membershipSummary(before, config, now);
  if (actor.role === 'CUSTOMER' && !summary.canCancel) {
    throw badRequest(`Memberships can be cancelled once 30 days have passed since the last call-out. You can cancel from ${new Date(summary.cancelFrom).toLocaleDateString('en-AU', { timeZone: 'Australia/Adelaide', dateStyle: 'medium' })}.`);
  }
  const refund = summary.refundIfCancelledToday;
  const customer = await prisma.$transaction(async (tx) => {
    if (refund > 0) {
      const count = await tx.invoice.count();
      await tx.invoice.create({
        data: {
          invoiceNumber: `INV-${now.getFullYear()}-${1000 + count + 1}`, organizationId: id, kind: 'REFUND',
          description: 'Pro-rata refund of prepaid membership fees on cancellation', amount: -refund,
          gst: -Math.round(refund * (config.gstRate ?? 0.1) * 100) / 100, status: 'PENDING', paymentMethod: before.paymentMethod, dueDate: now, paidAt: null
        }
      });
    }
    const cancelledPoints = await cancelAllPoints(tx, id, now);
    const updated = await tx.organization.update({ where: { id }, data: { subscriptionStatus: 'CANCELLED', cancelledAt: now, refundAmount: refund, pendingPlan: null, pendingPlanFrom: null }, include: { locations: true } });
    return { updated, cancelledPoints };
  });
  await recordAudit(actor, {
    action: 'SUBSCRIPTION_CANCELLED',
    entityType: 'Organization',
    entityId: id,
    diff: { subscriptionStatus: { from: before.subscriptionStatus, to: 'CANCELLED' }, refund, pointsCancelled: customer.cancelledPoints }
  });
  return {
    success: true,
    message: `Membership cancelled.${refund > 0 ? ` A pro-rata refund of $${refund.toFixed(2)} + GST will be paid.` : ''} Reward points have been cancelled.`,
    customer: withMembership(customer.updated, config)
  };
}

// Payments (cl. 4.4, 5.4): staff record a failed payment (the notice date) or that it was paid
export async function paymentStatus(actor, id, { failed }) {
  const before = await findOrganization(id);
  const data = failed
    ? { paymentNoticeAt: before.paymentNoticeAt || new Date() }
    : { paymentNoticeAt: null, cancellationReview: false, ...(before.subscriptionStatus === 'SUSPENDED' ? { subscriptionStatus: 'ACTIVE' } : {}) };
  const customer = await prisma.organization.update({ where: { id }, data, include: { locations: true } });
  await recordAudit(actor, { action: failed ? 'PAYMENT_FAILED' : 'PAYMENT_RECEIVED', entityType: 'Organization', entityId: id, diff: changedFields(before, data, ['paymentNoticeAt', 'subscriptionStatus', 'cancellationReview']) });
  return withMembership(customer, await getConfig());
}

// Account deletion (App Store 5.1.1(v)): the customer deletes their own company, or an admin deletes it
export async function remove(actor, id) {
  assertOrganizationAccess(actor, id);
  const customer = await findOrganization(id);

  await prisma.$transaction(async (tx) => {
    const jobs = await tx.emergencyRequest.findMany({ where: { organizationId: customer.id }, select: { id: true } });
    await tx.jobStatusEvent.deleteMany({ where: { jobId: { in: jobs.map(j => j.id) } } });
    await tx.emergencyRequest.deleteMany({ where: { organizationId: customer.id } });
    await tx.redemptionRequest.deleteMany({ where: { organizationId: customer.id } });
    await tx.user.deleteMany({ where: { organizationId: customer.id } });
    await tx.organization.delete({ where: { id: customer.id } });
  });

  await recordAudit(actor, {
    action: 'CUSTOMER_DELETED',
    entityType: 'Organization',
    entityId: customer.id,
    diff: {
      businessName: customer.businessName, abn: customer.abn, primaryContactName: customer.primaryContactName,
      phoneNumber: customer.phoneNumber, email: customer.email, membershipPlan: customer.membershipPlan, pointsBalance: customer.pointsBalance
    }
  });
  return { success: true, message: 'Account and all associated data have been permanently deleted.' };
}

const staffPlan = (actor, plan) => (actor.role === 'ADMIN' || actor.role === 'CONFIG') && PLAN_IDS.includes(plan);

// Multi-site management (Location table)
export async function addSite(actor, organizationId, body) {
  assertOrganizationAccess(actor, organizationId);
  const { name, address, contactName, contactPhone, accessInstructions, securityNotes } = body;
  const config = await getConfig();
  if (!isAdelaideLocation(address, config)) throw badRequest(ADELAIDE_ERROR);
  const org = await findOrganization(organizationId);
  const area = areaFields(address, config);

  const location = await prisma.location.create({
    data: {
      organizationId,
      name,
      address,
      contactName: contactName || org.primaryContactName,
      contactPhone: contactPhone || org.phoneNumber,
      accessInstructions: accessInstructions || null,
      securityNotes: securityNotes || null,
      ...area,
      ...(staffPlan(actor, body.membershipPlan) ? { membershipPlan: body.membershipPlan } : {})
    }
  });
  await recordAudit(actor, { action: 'LOCATION_CREATED', entityType: 'Location', entityId: location.id, diff: { customer: org.businessName, name, address, contactName: location.contactName, contactPhone: location.contactPhone, accessInstructions: location.accessInstructions, securityNotes: location.securityNotes, serviceArea: area.serviceArea } });
  return location;
}

export async function updateSite(actor, locationId, body) {
  const before = await prisma.location.findUnique({ where: { id: locationId } });
  if (!before) throw notFound('Location not found');
  assertOrganizationAccess(actor, before.organizationId);

  const { name, address, contactName, contactPhone, accessInstructions, securityNotes } = body;
  const config = await getConfig();
  if (address && !isAdelaideLocation(address, config)) throw badRequest(ADELAIDE_ERROR);
  const staff = actor.role === 'ADMIN' || actor.role === 'CONFIG';
  const data = {
    ...(address && address !== before.address ? areaFields(address, config) : {}),
    // Membership Schedule details only SACC staff change: the site's own plan, outside-metro approval and travel distance
    ...(staff && body.membershipPlan !== undefined && (body.membershipPlan === '' || PLAN_IDS.includes(body.membershipPlan)) ? { membershipPlan: body.membershipPlan || null } : {}),
    ...(staff && body.areaApproved !== undefined ? { areaApproved: Boolean(body.areaApproved) } : {}),
    ...(staff && body.travelKm !== undefined ? { travelKm: body.travelKm === '' || body.travelKm === null ? null : Math.max(0, parseFloat(body.travelKm) || 0) } : {}),
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
    ...(contactName ? { contactName } : {}),
    ...(contactPhone ? { contactPhone } : {}),
    ...(accessInstructions !== undefined ? { accessInstructions } : {}),
    ...(securityNotes !== undefined ? { securityNotes } : {})
  };
  const location = await prisma.location.update({ where: { id: locationId }, data });
  await recordAudit(actor, {
    action: 'LOCATION_UPDATED',
    entityType: 'Location',
    entityId: location.id,
    diff: changedFields(before, data, ['name', 'address', 'contactName', 'contactPhone', 'accessInstructions', 'securityNotes', 'membershipPlan', 'serviceArea', 'areaApproved', 'travelKm'])
  });
  return location;
}

// Reward points history (cl. 14): what was earned, spent and expired, and when each lot expires
export async function pointsHistory(actor, id) {
  assertOrganizationAccess(actor, id);
  return prisma.pointsEntry.findMany({ where: { organizationId: id }, orderBy: { createdAt: 'desc' }, take: 200 });
}
