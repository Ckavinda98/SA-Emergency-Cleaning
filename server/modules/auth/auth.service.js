import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { HttpError, badRequest } from '../../lib/httpError.js';
import { hashPassword, checkPassword } from '../../lib/passwords.js';
import { recordLogin } from '../../lib/loginLog.js';
import { recordAudit } from '../../lib/audit.js';
import { isAdelaideLocation, ADELAIDE_ERROR } from '../../../shared/location.js';
import { getConfig } from '../config/config.service.js';
import { newMemberFields, recordMembershipPayment } from '../../lib/membership.js';
import { creditPoints } from '../../lib/points.js';
import { areaFields } from '../customers/customers.service.js';


function issueTokens(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    technicianId: user.technicianId
  };
  return {
    accessToken: jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL }),
    refreshToken: jwt.sign({ userId: user.id, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL })
  };
}

// The user object the web app keeps after login
function toProfile(user) {
  const profile = { id: user.id, name: user.name, email: user.email, role: user.role.toLowerCase() }; // no stock photo: the app shows the person's initial
  if (user.role === 'CUSTOMER' && user.organization) {
    profile.businessId = user.organization.id;
    profile.businessName = user.organization.businessName;
  } else if (user.role === 'TECHNICIAN' && user.technician) {
    profile.techId = user.technicianId;
    profile.status = user.technician.status;
  }
  return profile;
}

export async function register(actor, body) {
  const { businessName, abn, primaryContactName, phoneNumber, email, password, membershipPlan, paymentType, address, locationName } = body;

  const targetAddress = address || locationName || '';
  const config = await getConfig();
  // Metro Adelaide sites are covered; other SA sites are accepted at SACC's discretion with travel (cl. 18)
  if (!isAdelaideLocation(targetAddress, config)) throw badRequest(ADELAIDE_ERROR);

  const normEmail = email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normEmail } })) {
    throw badRequest('An account with this email address already exists.');
  }

  const hashedPassword = await hashPassword(password);
  try {
    const { customer, user } = await prisma.$transaction(async (tx) => {
      const customer = await tx.organization.create({
        data: {
          businessName,
          abn: abn || '48 123 456 789',
          primaryContactName,
          phoneNumber,
          email: normEmail,
          membershipPlan: membershipPlan || 'business',
          paymentMethod: paymentType === 'CARD' ? 'Card (secure payment link)' : 'PayTo Bank Direct',
          paymentType: paymentType || 'DIRECT_DEBIT',
          subscriptionStatus: 'ACTIVE',
          ...(await newMemberFields(tx, config, body)),
          locations: {
            create: [{
              name: locationName || 'Primary Adelaide Site',
              address: targetAddress,
              contactName: primaryContactName,
              contactPhone: phoneNumber,
              accessInstructions: body.accessInstructions || null,
              securityNotes: null,
              ...areaFields(targetAddress, config)
            }]
          }
        },
        include: { locations: true }
      });
      const user = await tx.user.create({
        data: { email: normEmail, password: hashedPassword, name: primaryContactName, role: 'CUSTOMER', organizationId: customer.id }
      });
      // The first payment is the Activation Date (cl. 1): fee invoice, fee points and any referral reward
      await recordMembershipPayment(tx, customer, config, { creditPoints });
      return { customer, user };
    });

    await recordAudit({ ...actor, userId: user.id, email: user.email, role: 'CUSTOMER' }, {
      action: 'COMPANY_REGISTERED',
      entityType: 'Organization',
      entityId: customer.id,
      diff: { businessName, membershipPlan: customer.membershipPlan, email: customer.email, billingFrequency: customer.billingFrequency, membershipNumber: customer.membershipNumber, serviceArea: customer.locations[0]?.serviceArea, referredBy: customer.referredById ? 'yes' : 'no' }
    });

    return { success: true, message: `Company ${businessName} registered successfully!`, customer };
  } catch (error) {
    if (error.code === 'P2002') throw badRequest('A company with this email address is already registered.');
    throw error;
  }
}

// Login is checked against the User table only. There are no built-in or fallback users.
export async function login(actor, { email, password } = {}) {
  const input = (email || '').trim().toLowerCase();

  if (!input || !password) {
    await recordLogin(actor, { email: input, event: 'LOGIN_FAILED', reason: 'MISSING_FIELDS' });
    throw badRequest('Email and password are required.');
  }

  const user = await prisma.user.findUnique({ where: { email: input }, include: { organization: true, technician: true } });
  if (!user) {
    await recordLogin(actor, { email: input, event: 'LOGIN_FAILED', reason: 'UNKNOWN_EMAIL' });
    throw new HttpError(401, 'Invalid email or password.');
  }

  if (!(await checkPassword(password, user.password))) {
    await recordLogin(actor, { userId: user.id, email: input, role: user.role, event: 'LOGIN_FAILED', reason: 'WRONG_PASSWORD' });
    throw new HttpError(401, 'Invalid email or password.');
  }

  const { accessToken, refreshToken } = issueTokens(user);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken, lastLoginAt: new Date() } });
  await recordLogin(actor, { userId: user.id, email: user.email, role: user.role, event: 'LOGIN_SUCCESS' });

  return { success: true, accessToken, refreshToken, user: toProfile(user) };
}

export async function logout(actor) {
  await prisma.user.updateMany({ where: { id: actor.userId }, data: { refreshToken: null } });
  await recordLogin(actor, { userId: actor.userId, email: actor.email, role: actor.role, event: 'LOGOUT' });
  return { success: true };
}

// Refresh tokens rotate: each one works once, and logout revokes it
export async function refresh(actor, { refreshToken } = {}) {
  if (!refreshToken) throw new HttpError(401, 'Refresh token required');

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch (error) {
    await recordLogin(actor, { email: '', event: 'REFRESH_FAILED', reason: 'INVALID_TOKEN' });
    throw new HttpError(403, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || user.refreshToken !== refreshToken) {
    await recordLogin(actor, { userId: decoded.userId, email: user?.email || '', role: user?.role, event: 'REFRESH_FAILED', reason: 'TOKEN_NOT_CURRENT' });
    throw new HttpError(403, 'Invalid refresh token');
  }

  const tokens = issueTokens(user);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });
  return tokens;
}
