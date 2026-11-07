// Scheduled membership admin from the Operations SOP "monthly admin" list and the Agreement:
//  - 1st of the month: unused included call-outs become 30 points each, then every site's count resets (cl. 2.2, 14.3)
//  - each billing date: membership fee invoice and 1 point per $1 (cl. 4.2, 14.1)
//  - scheduled downgrades start with the new billing period (cl. 6.3)
//  - each membership anniversary: rates locked for the new period (cl. 15.2), Gold bonus call-out (cl. 15)
//  - points older than 12 months expire (cl. 14.5)
//  - unpaid 7 days after notice: suspended; 30 days: cancellation review (cl. 4.4, 5.4); extras invoices overdue after 7 days
// Runs when the API starts, every hour after that, and on demand from the admin desk. Safe to run more than once.
import { prisma } from '../db/prisma.js';
import { getConfig } from '../modules/config/config.service.js';
import { planFor } from '../../shared/config.js';
import { adelaideParts, billingPeriod, loyaltyLevel, monthsBetween } from '../../shared/membership.js';
import { creditPoints, expirePoints } from './points.js';
import { sitePlanId, lockRates, recordMembershipPayment } from './membership.js';

const STATE_KEY = 'HOUSEKEEPING_STATE';

async function readState() {
  const row = await prisma.systemDynamicConfig.findUnique({ where: { configKey: STATE_KEY } });
  return row ? JSON.parse(row.configValue) : {};
}
const writeState = (state) => prisma.systemDynamicConfig.upsert({
  where: { configKey: STATE_KEY }, update: { configValue: JSON.stringify(state) }, create: { configKey: STATE_KEY, configValue: JSON.stringify(state) }
});

export async function runHousekeeping(now = new Date()) {
  const config = await getConfig();
  const state = await readState();
  const { y, m } = adelaideParts(now);
  const monthKey = `${y}-${String(m).padStart(2, '0')}`;
  const done = { monthlyReset: false, unusedCalloutPoints: 0, feeInvoices: 0, downgrades: 0, ratesLocked: 0, expired: 0, suspended: 0, review: 0, overdueInvoices: 0 };
  const orgs = await prisma.organization.findMany({ where: { subscriptionStatus: { not: 'CANCELLED' } }, include: { locations: true } });

  // New calendar month: convert and reset (the first ever run only records the month)
  if (state.monthKey && state.monthKey !== monthKey) {
    for (const org of orgs) {
      await prisma.$transaction(async (tx) => {
        if (org.subscriptionStatus === 'ACTIVE') {
          const unused = org.locations.reduce((sum, l) => sum + Math.max(0, planFor(config, sitePlanId(l, org)).callouts - (l.calloutsUsed || 0)), 0);
          if (unused) {
            await creditPoints(tx, org.id, unused * (config.unusedCalloutPoints ?? 30), 'UNUSED_CALLOUT', `${unused} unused call-out(s) in ${state.monthKey}`, config, now);
            done.unusedCalloutPoints += unused * (config.unusedCalloutPoints ?? 30);
          }
        }
        await tx.location.updateMany({ where: { organizationId: org.id }, data: { calloutsUsed: 0 } });
        await tx.organization.update({ where: { id: org.id }, data: { calloutsUsed: 0 } });
      });
    }
    done.monthlyReset = true;
  }

  for (const org of orgs) {
    // Scheduled downgrade
    if (org.pendingPlan && org.pendingPlanFrom && new Date(org.pendingPlanFrom) <= now) {
      await prisma.organization.update({ where: { id: org.id }, data: { membershipPlan: org.pendingPlan, pendingPlan: null, pendingPlanFrom: null } });
      org.membershipPlan = org.pendingPlan;
      done.downgrades++;
    }
    // New membership year: lock rates; Gold members get their bonus call-out
    if (!org.ratesLockedUntil || new Date(org.ratesLockedUntil) <= now) {
      await prisma.organization.update({ where: { id: org.id }, data: lockRates(config, org, now) });
      done.ratesLocked++;
    }
    const year = Math.floor(monthsBetween(org.activationDate, now) / 12);
    if (loyaltyLevel(org.activationDate, now, config)?.id === 'gold' && org.bonusCalloutYear < year) {
      await prisma.organization.update({ where: { id: org.id }, data: { bonusCallouts: 1, bonusCalloutYear: year } });
    }
    // Billing date reached since the last run: fee invoice and fee points, once per period
    // (direct debit is taken as paid unless staff record a failure). The first ever run bills nothing.
    const period = billingPeriod(org.activationDate, org.billingFrequency, now);
    const periodKey = period.start.toISOString().slice(0, 10);
    const lastRun = state.lastRunAt ? new Date(state.lastRunAt) : null;
    if (lastRun && period.start > lastRun && org.subscriptionStatus === 'ACTIVE' && period.start > new Date(org.activationDate) && !org.paymentNoticeAt) {
      const exists = await prisma.invoice.findFirst({ where: { organizationId: org.id, kind: 'MEMBERSHIP', description: { contains: `period from ${periodKey}` } } });
      if (!exists) {
        await prisma.$transaction((tx) => recordMembershipPayment(tx, org, config, { creditPoints }, now));
        done.feeInvoices++;
      }
    }
    // Unpaid membership fees
    if (org.paymentNoticeAt) {
      const days = (now - new Date(org.paymentNoticeAt)) / 86400000;
      if (days >= (config.suspendAfterDays ?? 7) && org.subscriptionStatus === 'ACTIVE') {
        await prisma.organization.update({ where: { id: org.id }, data: { subscriptionStatus: 'SUSPENDED' } });
        done.suspended++;
      }
      if (days >= (config.cancellationReviewAfterDays ?? 30) && !org.cancellationReview) {
        await prisma.organization.update({ where: { id: org.id }, data: { cancellationReview: true } });
        done.review++;
      }
    }
  }

  done.expired = await prisma.$transaction((tx) => expirePoints(tx, now));
  const overdue = await prisma.invoice.updateMany({ where: { status: 'PENDING', kind: { in: ['EXTRAS', 'MEMBERSHIP', 'REDEMPTION'] }, dueDate: { lt: now } }, data: { status: 'OVERDUE' } });
  done.overdueInvoices = overdue.count;

  await writeState({ ...state, monthKey, lastRunAt: now.toISOString() });
  return done;
}

// Hourly in the API process. Errors are logged, never thrown.
export function startHousekeeping() {
  const run = () => runHousekeeping().catch(e => console.warn('Housekeeping failed:', e.message));
  run();
  return setInterval(run, 60 * 60 * 1000);
}
