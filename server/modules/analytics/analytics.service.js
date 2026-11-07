import { prisma } from '../../db/prisma.js';
import { ACTIVE_STATUSES, COMPLETED_STATUSES } from '../../../shared/jobStatus.js';
import { getConfig } from '../config/config.service.js';
import { runHousekeeping } from '../../lib/housekeeping.js';
import { recordAudit } from '../../lib/audit.js';

// All figures computed from the database
export async function summary() {
  const config = await getConfig();
  const [totalJobs, activeJobs, completedJobs, totalCustomers, activeCustomers, pendingRedemptions] = await Promise.all([
    prisma.emergencyRequest.count(),
    prisma.emergencyRequest.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.emergencyRequest.count({ where: { status: { in: COMPLETED_STATUSES } } }),
    prisma.organization.count(),
    prisma.organization.count({ where: { subscriptionStatus: 'ACTIVE' } }),
    prisma.redemptionRequest.count({ where: { status: 'PENDING_APPROVAL' } })
  ]);

  // Response time is measured from SACC's acknowledgment (cl. 13.1), inside the plan's service window (cl. 13.2)
  const arrivals = await prisma.jobStatusEvent.findMany({
    where: { toStatus: 'ARRIVED' },
    orderBy: { createdAt: 'asc' },
    include: { job: { select: { id: true, jobNumber: true, customerName: true, submittedAt: true, responseClockStartAt: true, targetAttendanceAt: true, goodwillCredited: true } } }
  });
  const firstArrival = new Map();
  for (const ev of arrivals) if (!firstArrival.has(ev.jobId)) firstArrival.set(ev.jobId, ev);
  const attended = [...firstArrival.values()].filter(ev => ev.job.targetAttendanceAt);
  const late = attended.filter(ev => ev.createdAt > ev.job.targetAttendanceAt);
  const avgAttendance = attended.length
    ? Math.round(attended.reduce((sum, ev) => sum + (ev.createdAt - (ev.job.responseClockStartAt || ev.job.submittedAt)) / 60000, 0) / attended.length)
    : null;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const revenue = await prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: 'PAID', createdAt: { gte: monthStart } } });

  // Things the admin desk must follow up (Operations SOP)
  const now = Date.now();
  const greyCutoff = new Date(now - (config.greyAreaDecisionMinutes ?? 15) * 60000);
  const reportCutoff = new Date(now - (config.reportDueHours ?? 24) * 3600000);
  const [notAcknowledged, greyArea, reportsDue, awaitingQuote, outsideMetroSites, suspended, review, overdueInvoices] = await Promise.all([
    prisma.emergencyRequest.findMany({ where: { acknowledgedAt: null, status: { in: ['NEW', 'SUBMITTED'] } }, select: { id: true, jobNumber: true, customerName: true, submittedAt: true } }),
    prisma.emergencyRequest.findMany({ where: { triage: 'GREY_AREA', status: 'UNDER_REVIEW', triagedAt: { lt: greyCutoff } }, select: { id: true, jobNumber: true, customerName: true, triagedAt: true } }),
    prisma.emergencyRequest.findMany({ where: { reportIssuedAt: null, status: { in: ['COMPLETED', 'UNABLE_TO_ACCESS'] }, OR: [{ completedAt: { lt: reportCutoff } }, { missedAccessAt: { lt: reportCutoff } }] }, select: { id: true, jobNumber: true, customerName: true, completedAt: true } }),
    prisma.emergencyRequest.findMany({ where: { quoteStatus: 'PENDING' }, select: { id: true, jobNumber: true, customerName: true, quoteAmount: true } }),
    prisma.location.findMany({ where: { serviceArea: 'OUTSIDE_METRO', areaApproved: false }, select: { id: true, name: true, address: true, organizationId: true } }),
    prisma.organization.findMany({ where: { subscriptionStatus: 'SUSPENDED' }, select: { id: true, businessName: true } }),
    prisma.organization.findMany({ where: { cancellationReview: true, subscriptionStatus: { not: 'CANCELLED' } }, select: { id: true, businessName: true } }),
    prisma.invoice.count({ where: { status: 'OVERDUE' } })
  ]);

  return {
    totalJobs,
    activeJobs,
    completedJobs,
    totalCustomers,
    activeCustomers,
    pendingRedemptions,
    slaResponseSuccessRate: attended.length ? `${(((attended.length - late.length) / attended.length) * 100).toFixed(1)}%` : 'No data yet',
    avgAttendanceTimeMinutes: avgAttendance,
    totalRevenueMonth: revenue._sum.amount || 0,
    attention: {
      notAcknowledged,
      greyArea,
      reportsDue,
      awaitingQuote,
      goodwillDue: late.filter(ev => !ev.job.goodwillCredited).map(ev => ({ id: ev.job.id, jobNumber: ev.job.jobNumber, customerName: ev.job.customerName, arrivedAt: ev.createdAt, targetAttendanceAt: ev.job.targetAttendanceAt })),
      outsideMetroSites,
      suspended,
      cancellationReview: review,
      overdueInvoices
    }
  };
}

export async function housekeeping(actor) {
  const result = await runHousekeeping();
  await recordAudit(actor, { action: 'HOUSEKEEPING_RUN', entityType: 'SystemDynamicConfig', entityId: 'HOUSEKEEPING_STATE', diff: result });
  return result;
}
