// Membership figures worked out on the server from the Agreement rules (shared/membership.js),
// returned with every customer record so all pages show the same numbers.
import crypto from 'crypto';
import { planFor } from '../../shared/config.js';
import {
  membershipFee, inWaitingPeriod, membershipDay, monthsBetween, loyaltyLevel, daysUntilMonthlyReset,
  billingPeriod, proRata, addMonths, windowLabel, surchargeText
} from '../../shared/membership.js';

export const sitePlanId = (location, org) => location?.membershipPlan || org.membershipPlan || 'business';

// Rates fixed for the current membership period (cl. 15.2), or the plan's current rates
export function ratesFor(org, config, planId = org.membershipPlan) {
  const plan = planFor(config, planId);
  const current = { labourRate: plan.labourRate, additionalCalloutFee: config.additionalCalloutFee, price: plan.price };
  if (!org.lockedRatesJson || !org.ratesLockedUntil || new Date(org.ratesLockedUntil) < new Date()) return current;
  try {
    const locked = JSON.parse(org.lockedRatesJson)[planId];
    return locked ? { ...current, ...locked } : current;
  } catch { return current; }
}

// Snapshot of every plan's rates for the coming membership period
export function lockRates(config, org, from = new Date()) {
  const snapshot = Object.fromEntries((config.membershipPlans || []).map(p => [p.id, { labourRate: p.labourRate, additionalCalloutFee: config.additionalCalloutFee, price: p.price }]));
  const activation = new Date(org.activationDate || from);
  const years = Math.floor(monthsBetween(activation, from) / 12);
  return { lockedRatesJson: JSON.stringify(snapshot), ratesLockedUntil: addMonths(activation, (years + 1) * 12) };
}

export const newReferralCode = () => `REF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export async function nextMembershipNumber(tx) {
  const count = await tx.organization.count();
  for (let n = count + 1; ; n++) {
    const number = `SACC-M${String(1000 + n).padStart(5, '0')}`;
    if (!(await tx.organization.findUnique({ where: { membershipNumber: number } }))) return number;
  }
}

export function membershipSummary(org, config, at = new Date()) {
  const locations = org.locations || [];
  const sites = locations.map(l => {
    const plan = planFor(config, sitePlanId(l, org));
    return {
      id: l.id, name: l.name, planId: plan.id, planName: plan.name, included: plan.callouts, used: l.calloutsUsed || 0,
      remaining: Math.max(0, plan.callouts - (l.calloutsUsed || 0)), serviceArea: l.serviceArea, areaApproved: l.areaApproved, travelKm: l.travelKm
    };
  });
  const fee = membershipFee(sites.length ? sites.map(s => s.planId) : [org.membershipPlan], config);
  const plan = planFor(config, org.membershipPlan);
  const rates = ratesFor(org, config);
  const months = monthsBetween(org.activationDate, at);
  const level = loyaltyLevel(org.activationDate, at, config);
  const period = billingPeriod(org.activationDate, org.billingFrequency, at);
  const periodFee = org.billingFrequency === 'ANNUAL' ? fee.annual : fee.monthly;
  const cancelDays = config.cancelAfterCalloutDays ?? 30;
  const cancelFrom = org.lastCalloutAt ? new Date(new Date(org.lastCalloutAt).getTime() + cancelDays * 86400000) : null;
  const included = sites.reduce((s, x) => s + x.included, 0) || plan.callouts;
  const used = sites.length ? sites.reduce((s, x) => s + x.used, 0) : (org.calloutsUsed || 0);
  return {
    planId: plan.id,
    planName: plan.name,
    labourRate: rates.labourRate,
    additionalCalloutFee: rates.additionalCalloutFee,
    serviceWindow: windowLabel(plan),
    surcharges: surchargeText(plan, config),
    priorityLabel: plan.priorityLabel,
    ratesLockedUntil: org.ratesLockedUntil,
    fee,
    periodFee,
    billingFrequency: org.billingFrequency,
    nextBillingDate: period.end,
    activationDate: org.activationDate,
    membershipDay: membershipDay(org.activationDate, at),
    inWaitingPeriod: inWaitingPeriod(org.activationDate, at, config),
    waitingPeriodEnds: new Date(new Date(org.activationDate).getTime() + (config.waitingPeriodDays ?? 10) * 86400000),
    monthsActive: months,
    termEnds: addMonths(org.activationDate, Math.max(1, Math.ceil((months + 1) / 12)) * 12),
    loyaltyLevel: level ? level.name : null,
    loyaltyBenefit: level ? level.benefit : null,
    redeemUnlocked: months >= (config.tenureMinMonths ?? 6),
    redeemUnlocksOn: addMonths(org.activationDate, config.tenureMinMonths ?? 6),
    daysUntilReset: daysUntilMonthlyReset(at),
    sites,
    included,
    used,
    remaining: Math.max(0, included - used),
    bonusCallouts: org.bonusCallouts || 0,
    canCancel: !cancelFrom || cancelFrom <= at,
    cancelFrom,
    refundIfCancelledToday: proRata(periodFee, period.start, period.end, at),
    pendingPlan: org.pendingPlan,
    pendingPlanFrom: org.pendingPlanFrom,
    suspended: org.subscriptionStatus === 'SUSPENDED'
  };
}

// The customer record the API returns: database row plus the worked-out membership figures
export const withMembership = (org, config) => (org ? { ...org, lockedRatesJson: undefined, membership: membershipSummary(org, config) } : org);

// Fields every new member gets (cl. 1 Activation Date, 15.2 locked rates, 19.2 membership number, 14.7 referral code)
export async function newMemberFields(tx, config, { referralCode, billingFrequency } = {}, at = new Date()) {
  const referrer = referralCode ? await tx.organization.findUnique({ where: { referralCode: String(referralCode).trim().toUpperCase() } }) : null;
  return {
    activationDate: at,
    billingFrequency: billingFrequency === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
    membershipNumber: await nextMembershipNumber(tx),
    referralCode: newReferralCode(),
    referredById: referrer?.id || null,
    ...lockRates(config, { activationDate: at }, at),
    consecutiveMonths: 0,
    pointsBalance: 0,
    calloutsUsed: 0
  };
}

// First membership payment (cl. 4.2): invoice, fee points (cl. 14.1), referral reward to the referrer (cl. 14.7)
export async function recordMembershipPayment(tx, org, config, { creditPoints }, at = new Date()) {
  const full = await tx.organization.findUnique({ where: { id: org.id }, include: { locations: true } });
  const summary = membershipSummary(full, config, at);
  const amount = summary.periodFee;
  const count = await tx.invoice.count();
  const period = billingPeriod(full.activationDate, full.billingFrequency, at);
  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber: `INV-${at.getFullYear()}-${1000 + count + 1}`,
      organizationId: org.id,
      kind: 'MEMBERSHIP',
      description: `${summary.planName} membership, ${full.billingFrequency === 'ANNUAL' ? 'annual' : 'monthly'} fee for period from ${period.start.toISOString().slice(0, 10)}${summary.fee.discountPercent ? ` (${summary.fee.discountPercent}% multi-site discount)` : ''}`,
      amount,
      gst: Math.round(amount * (config.gstRate ?? 0.1) * 100) / 100,
      status: 'PAID',
      paymentMethod: full.paymentMethod,
      dueDate: at,
      paidAt: at
    }
  });
  await creditPoints(tx, org.id, Math.floor(amount), 'FEES', `Membership fee ${invoice.invoiceNumber}`, config, at);
  if (full.referredById && !full.referralRewarded) {
    await creditPoints(tx, full.referredById, config.referralPoints ?? 100, 'REFERRAL', `Referred ${full.businessName}`, config, at);
    await tx.organization.update({ where: { id: org.id }, data: { referralRewarded: true } });
  }
  return invoice;
}
