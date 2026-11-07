import { prisma } from '../../db/prisma.js';
import { badRequest, notFound } from '../../lib/httpError.js';
import { recordAudit, changedFields } from '../../lib/audit.js';
import { assertOrganizationAccess, jobScope } from '../../lib/access.js';
import { hashPassword, generateTempPassword } from '../../lib/passwords.js';
import { isAdelaideLocation, ADELAIDE_ERROR } from '../../../shared/location.js';

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
  return prisma.organization.findMany({ where, include: { locations: true }, orderBy: { createdAt: 'asc' } });
}

export async function get(actor, id) {
  assertOrganizationAccess(actor, id);
  const customer = await prisma.organization.findUnique({ where: { id }, include: { locations: true } });
  if (!customer) throw notFound('Customer not found');
  return customer;
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
  const sites = Array.isArray(body.locations) && body.locations.length
    ? body.locations.map(l => ({
        name: l.name || 'Primary Site',
        address: l.address || body.address || 'Adelaide SA 5000',
        contactName: l.contactName || primaryContactName,
        contactPhone: l.contactPhone || phoneNumber,
        accessInstructions: l.accessInstructions || null,
        securityNotes: l.securityNotes || null
      }))
    : [{
        name: 'Primary Site',
        address: body.address || 'Adelaide SA 5000',
        contactName: primaryContactName,
        contactPhone: phoneNumber,
        accessInstructions: 'Main Door Access Keypad',
        securityNotes: 'Standard Site'
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
        consecutiveMonths: 1,
        pointsBalance: 0,
        calloutsUsed: 0,
        locations: { create: sites }
      },
      include: { locations: true }
    });
    await tx.user.create({
      data: { email: normEmail, password: hashedPassword, name: primaryContactName.trim(), role: 'CUSTOMER', organizationId: org.id }
    });
    return org;
  });

  await recordAudit(actor, {
    action: 'CUSTOMER_CREATED',
    entityType: 'Organization',
    entityId: customer.id,
    diff: { businessName: customer.businessName, email: normEmail, membershipPlan: customer.membershipPlan }
  });

  return { ...customer, loginEmail: normEmail, tempPassword: body.password ? undefined : tempPassword };
}

export async function updateProfile(actor, id, body) {
  assertOrganizationAccess(actor, id);
  const { businessName, primaryContactName, phoneNumber, email, password } = body;
  const before = await findOrganization(id);

  const updateData = {};
  if (businessName) updateData.businessName = businessName;
  if (primaryContactName) updateData.primaryContactName = primaryContactName;
  if (phoneNumber) updateData.phoneNumber = phoneNumber;
  if (email) updateData.email = email.trim().toLowerCase();

  // The login account of this company: the signed-in customer, or the user with the company email
  const loginUser = actor.role === 'CUSTOMER'
    ? await prisma.user.findUnique({ where: { id: actor.userId } })
    : await prisma.user.findFirst({ where: { organizationId: id, email: before.email } });

  if (updateData.email && updateData.email !== before.email) {
    const taken = await prisma.user.findUnique({ where: { email: updateData.email } });
    if (taken && taken.id !== loginUser?.id) throw badRequest('An account with this email address already exists.');
  }

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

  const diff = changedFields(before, updateData, ['businessName', 'primaryContactName', 'phoneNumber', 'email']);
  if (password) diff.password = 'changed';
  await recordAudit(actor, { action: 'PROFILE_UPDATED', entityType: 'Organization', entityId: customer.id, diff });

  return { success: true, message: 'Profile updated successfully!', customer };
}

export async function changePlan(actor, id, membershipPlan) {
  assertOrganizationAccess(actor, id);
  const before = await findOrganization(id);
  const customer = await prisma.organization.update({ where: { id }, data: { membershipPlan }, include: { locations: true } });
  await recordAudit(actor, {
    action: 'PLAN_CHANGED',
    entityType: 'Organization',
    entityId: customer.id,
    diff: { membershipPlan: { from: before.membershipPlan, to: membershipPlan } }
  });
  return { success: true, message: `Membership plan updated to ${membershipPlan.toUpperCase()}!`, customer };
}

export async function cancelSubscription(actor, id) {
  assertOrganizationAccess(actor, id);
  const before = await findOrganization(id);
  const customer = await prisma.organization.update({ where: { id }, data: { subscriptionStatus: 'CANCELLED' }, include: { locations: true } });
  await recordAudit(actor, {
    action: 'SUBSCRIPTION_CANCELLED',
    entityType: 'Organization',
    entityId: customer.id,
    diff: { subscriptionStatus: { from: before.subscriptionStatus, to: 'CANCELLED' } }
  });
  return {
    success: true,
    message: 'Subscription has been cancelled. Access will remain active until the current billing cycle ends.',
    customer
  };
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
    diff: { businessName: customer.businessName, email: customer.email }
  });
  return { success: true, message: 'Account and all associated data have been permanently deleted.' };
}

// Multi-site management (Location table)
export async function addSite(actor, organizationId, body) {
  assertOrganizationAccess(actor, organizationId);
  const { name, address, contactName, contactPhone, accessInstructions, securityNotes } = body;
  if (!isAdelaideLocation(address)) throw badRequest(ADELAIDE_ERROR);
  const org = await findOrganization(organizationId);

  const location = await prisma.location.create({
    data: {
      organizationId,
      name,
      address,
      contactName: contactName || org.primaryContactName,
      contactPhone: contactPhone || org.phoneNumber,
      accessInstructions: accessInstructions || null,
      securityNotes: securityNotes || null
    }
  });
  await recordAudit(actor, { action: 'LOCATION_CREATED', entityType: 'Location', entityId: location.id, diff: { organizationId: org.id, name, address } });
  return location;
}

export async function updateSite(actor, locationId, body) {
  const before = await prisma.location.findUnique({ where: { id: locationId } });
  if (!before) throw notFound('Location not found');
  assertOrganizationAccess(actor, before.organizationId);

  const { name, address, contactName, contactPhone, accessInstructions, securityNotes } = body;
  if (address && !isAdelaideLocation(address)) throw badRequest(ADELAIDE_ERROR);
  const data = {
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
    diff: changedFields(before, data, ['name', 'address', 'contactName', 'contactPhone', 'accessInstructions', 'securityNotes'])
  });
  return location;
}
