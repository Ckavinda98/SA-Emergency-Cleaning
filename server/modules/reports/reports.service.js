import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { HttpError, forbidden, notFound } from '../../lib/httpError.js';
import { TIMELINE_STAGES, COMPLETED_STATUSES } from '../../../shared/jobStatus.js';
import { renderServiceReport, escapeHtml } from './reportHtml.js';

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

// Times of each lifecycle stage, response time, labour time and SLA result, from JobStatusEvent rows
export function buildTimeline(job) {
  const firstAt = (statuses) => {
    const ev = job.statusEvents.find(e => statuses.includes(e.toStatus));
    return ev ? ev.createdAt : null;
  };
  const stageTimes = TIMELINE_STAGES.map(s => (s.statuses.includes('NEW') ? (firstAt(s.statuses) || job.submittedAt) : firstAt(s.statuses)));
  stageTimes[5] = job.workStartedAt || stageTimes[5];
  stageTimes[6] = job.completedAt || stageTimes[6];

  const arrivedAt = stageTimes[4];
  const responseTimeMinutes = arrivedAt ? Math.round((new Date(arrivedAt) - new Date(job.submittedAt)) / 60000) : null;
  const labourDurationMinutes = job.workStartedAt && job.completedAt
    ? Math.max(1, Math.round((new Date(job.completedAt) - new Date(job.workStartedAt)) / 60000))
    : (job.timerMinutes || 0);
  const slaStatus = !arrivedAt
    ? 'Not yet attended'
    : (job.targetAttendanceAt && new Date(arrivedAt) <= new Date(job.targetAttendanceAt) ? '✓ PASSED (On Schedule)' : '✗ MISSED');
  return { stageTimes, responseTimeMinutes, labourDurationMinutes, slaStatus };
}

export async function serviceReportHtml(token, jobId, download) {
  const viewer = verifyViewer(token);
  const job = await prisma.emergencyRequest.findUnique({
    where: { id: jobId },
    include: { organization: true, location: true, statusEvents: { orderBy: { createdAt: 'asc' } } }
  });
  if (!job) throw notFound('Job record not found');
  if (viewer.role === 'CUSTOMER' && viewer.organizationId !== job.organizationId) throw forbidden();

  const { stageTimes, responseTimeMinutes, labourDurationMinutes, slaStatus } = buildTimeline(job);
  const actorFor = ['customerName', null, 'technicianName', null, 'locationName', null, null];
  const timelineRows = TIMELINE_STAGES.map((s, i) => `
                <tr style="border-bottom: 1px solid #e2e8f0;${i === 6 ? ' background: #ecfdf5;' : ''}">
                  <td style="padding: 8px;"><strong>${s.label}</strong></td>
                  <td style="padding: 8px;">${escapeHtml(fmt(stageTimes[i], i === 0 || i === 6))}</td>
                  <td style="padding: 8px;">${escapeHtml(actorFor[i] ? job[actorFor[i]] || '-' : (i === 1 ? 'SACC Operations Desk' : '-'))}</td>
                </tr>`).join('');

  return {
    jobNumber: job.jobNumber || job.id,
    html: renderServiceReport({
      job,
      photos: JSON.parse(job.photosJson || '[]'),
      download,
      submittedFormatted: fmt(job.submittedAt, true),
      completedFormatted: fmt(job.completedAt, true),
      timelineRows,
      responseTimeMinutes,
      labourDurationMinutes,
      slaStatus,
      isCompleted: COMPLETED_STATUSES.includes(job.status)
    })
  };
}
