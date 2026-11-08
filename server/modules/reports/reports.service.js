import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { HttpError, forbidden, notFound } from '../../lib/httpError.js';
import { parseJob } from '../../lib/jobs.js';
import { getConfig } from '../config/config.service.js';
import { planFor } from '../../../shared/config.js';
import { jobCharges, HAZARDS, WATER_TYPES } from '../../../shared/membership.js';
import { ratesFor } from '../../lib/membership.js';
import { isJobAssignedToTechnician } from '../../lib/access.js';
import { renderServiceReport } from './reportHtml.js';
import { renderServiceReportPdf } from './reportPdf.js';

const fmt = (d, withDate = false) => d
  ? new Date(d).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', ...(withDate ? { dateStyle: 'medium' } : {}), timeStyle: 'short' })
  : 'Not recorded';

// The report opens in a new browser tab, so the token comes as ?token= (or the Authorization header)
export function verifyViewer(token) {
  try {
    return jwt.verify(String(token || ''), env.JWT_SECRET);
  } catch (e) {
    throw new HttpError(401, 'Please sign in to view this report.');
  }
}

// Arrival and response time (acknowledgment to arrival, cl. 13.1), from JobStatusEvent rows
export function buildTimes(job) {
  const arrived = job.statusEvents.find(e => e.toStatus === 'ARRIVED');
  const arrivedAt = arrived ? arrived.createdAt : null;
  const from = job.responseClockStartAt || job.acknowledgedAt;
  const responseMinutes = arrivedAt && from ? Math.max(0, Math.round((new Date(arrivedAt) - new Date(from)) / 60000)) : null;
  const responseNote = job.responseClockStartAt && job.acknowledgedAt && +new Date(job.responseClockStartAt) !== +new Date(job.acknowledgedAt)
    ? 'clock started at 6:00 am, the start of the service window' : null;
  return { arrivedAt, responseMinutes, responseNote };
}

// Everything the report shows, for any signed-in viewer allowed to see the job
async function loadReport(token, jobId) {
  const viewer = verifyViewer(token);
  const row = await prisma.emergencyRequest.findUnique({
    where: { id: jobId },
    include: { organization: true, location: true, statusEvents: { orderBy: { createdAt: 'asc' } } }
  });
  if (!row) throw notFound('Job record not found');
  if (viewer.role === 'CUSTOMER' && viewer.organizationId !== row.organizationId) throw forbidden();
  if (viewer.role === 'TECHNICIAN' && !(await isJobAssignedToTechnician(viewer, row))) throw forbidden();

  const config = await getConfig();
  const job = parseJob(row);
  const plan = planFor(config, job.planAtBooking || row.organization?.membershipPlan);
  const rates = ratesFor(row.organization, config, plan.id);
  const charges = job.chargesJson ? JSON.parse(job.chargesJson) : jobCharges(job, plan, config, rates);
  const finishedAt = job.completedAt || job.missedAccessAt || job.cancelledAt;
  return {
      job,
      org: row.organization,
      fmt,
      config,
      planName: plan.name,
      rates,
      charges,
      waterLabel: WATER_TYPES.find(w => w.id === job.waterType)?.label,
      hazardLabels: job.hazards.map(h => HAZARDS.find(x => x.id === h)?.label || h),
      issuedOnTime: Boolean(finishedAt && job.reportIssuedAt && new Date(job.reportIssuedAt) - new Date(finishedAt) <= (config.reportDueHours ?? 24) * 3600000),
      ...buildTimes(job)
  };
}

export async function serviceReportHtml(token, jobId, download) {
  const r = await loadReport(token, jobId);
  return { jobNumber: r.job.jobNumber || r.job.id, html: renderServiceReport({ ...r, download }) };
}

// The client's report template filled in, as a PDF file (any role that can see the job)
export async function serviceReportPdf(token, jobId) {
  const r = await loadReport(token, jobId);
  const pdf = await renderServiceReportPdf(r);
  return { fileName: `${r.job.reportNumber || r.job.jobNumber || r.job.id}-service-report.pdf`, pdf };
}
