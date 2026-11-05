import { prisma } from '../../db/prisma.js';
import { ACTIVE_STATUSES, COMPLETED_STATUSES } from '../../../shared/jobStatus.js';

// All figures computed from the database
export async function summary() {
  const [totalJobs, activeJobs, completedJobs, totalCustomers, activeCustomers, pendingRedemptions] = await Promise.all([
    prisma.emergencyRequest.count(),
    prisma.emergencyRequest.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.emergencyRequest.count({ where: { status: { in: COMPLETED_STATUSES } } }),
    prisma.organization.count(),
    prisma.organization.count({ where: { subscriptionStatus: 'ACTIVE' } }),
    prisma.redemptionRequest.count({ where: { status: 'PENDING_APPROVAL' } })
  ]);

  // SLA and attendance time from the first ARRIVED event of each job
  const arrivals = await prisma.jobStatusEvent.findMany({
    where: { toStatus: 'ARRIVED' },
    orderBy: { createdAt: 'asc' },
    include: { job: { select: { submittedAt: true, targetAttendanceAt: true } } }
  });
  const firstArrival = new Map();
  for (const ev of arrivals) if (!firstArrival.has(ev.jobId)) firstArrival.set(ev.jobId, ev);
  const attended = [...firstArrival.values()];
  const onTime = attended.filter(ev => !ev.job.targetAttendanceAt || ev.createdAt <= ev.job.targetAttendanceAt).length;
  const avgAttendance = attended.length
    ? Math.round(attended.reduce((sum, ev) => sum + (ev.createdAt - ev.job.submittedAt) / 60000, 0) / attended.length)
    : null;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const revenue = await prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: 'PAID', createdAt: { gte: monthStart } } });

  return {
    totalJobs,
    activeJobs,
    completedJobs,
    totalCustomers,
    activeCustomers,
    pendingRedemptions,
    slaResponseSuccessRate: attended.length ? `${((onTime / attended.length) * 100).toFixed(1)}%` : 'No data yet',
    avgAttendanceTimeMinutes: avgAttendance,
    totalRevenueMonth: revenue._sum.amount || 0
  };
}
