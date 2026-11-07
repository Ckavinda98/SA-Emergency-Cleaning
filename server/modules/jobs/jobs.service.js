import { prisma } from '../../db/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/httpError.js';
import { recordAudit, changedFields } from '../../lib/audit.js';
import { assertOrganizationAccess, isJobAssignedToTechnician, jobScope } from '../../lib/access.js';
import { parseJob } from '../../lib/jobs.js';
import { getConfig } from '../config/config.service.js';
import { planFor } from '../../../shared/config.js';
import { FINISHED_STATUSES, canTechnicianMove, DISPATCHED_STATUSES } from '../../../shared/jobStatus.js';
import { coverageWarnings, inWaitingPeriod, responseTarget, surchargeFor, jobCharges, parseList, onSiteMissing } from '../../../shared/membership.js';
import { sitePlanId, ratesFor } from '../../lib/membership.js';
import { creditPoints } from '../../lib/points.js';

const EDITABLE_FIELDS = [
  'category', 'description', 'affectedArea', 'incidentTime', 'isOngoing', 'isSafeToAccess', 'onsiteContact',
  'onsitePhone', 'accessInstructions', 'accessRestrictions', 'parkingInstructions', 'waterType'
];

async function findJob(id, include) {
  const job = await prisma.emergencyRequest.findUnique({ where: { id }, include });
  if (!job) throw notFound('Emergency request job not found.');
  return job;
}

// Adds the worked-out charges (Agreement cl. 3, 7, 8, 12, 18) to each job the API returns
async function decorate(jobs) {
  const config = await getConfig();
  const orgIds = [...new Set(jobs.map(j => j.organizationId))];
  const orgs = new Map((await prisma.organization.findMany({ where: { id: { in: orgIds } } })).map(o => [o.id, o]));
  // First arrival of each job: the end of the response time (cl. 13)
  const arrivals = await prisma.jobStatusEvent.findMany({ where: { jobId: { in: jobs.map(j => j.id) }, toStatus: 'ARRIVED' }, orderBy: { createdAt: 'asc' } });
  const arrivedAt = new Map();
  for (const ev of arrivals) if (!arrivedAt.has(ev.jobId)) arrivedAt.set(ev.jobId, ev.createdAt);
  return jobs.map(job => {
    const org = orgs.get(job.organizationId);
    const planId = job.planAtBooking || org?.membershipPlan;
    const plan = planFor(config, planId);
    const charges = job.chargesJson ? JSON.parse(job.chargesJson) : jobCharges(job, plan, config, org ? ratesFor(org, config, planId) : {});
    return { ...parseJob(job), planName: plan?.name, charges, membershipNumber: org?.membershipNumber || null, arrivedAt: arrivedAt.get(job.id) || null };
  });
}
const decorateOne = async (job) => (await decorate([job]))[0];

export async function list(actor) {
  const jobs = await prisma.emergencyRequest.findMany({ where: await jobScope(actor), orderBy: { submittedAt: 'desc' } });
  return decorate(jobs);
}

// One job with its full status timeline (used by the PDF download and job details)
export async function get(actor, id) {
  const job = await findJob(id, { statusEvents: { orderBy: { createdAt: 'asc' } } });
  assertOrganizationAccess(actor, job.organizationId);
  if (actor.role === 'TECHNICIAN' && !(await isJobAssignedToTechnician(actor, job))) throw forbidden('This job is not assigned to you.');
  return decorateOne(job);
}

const isDispatched = (job) => DISPATCHED_STATUSES.includes(job.status) || Boolean(job.technicianName && job.technicianName !== 'Unassigned' && !FINISHED_STATUSES.includes(job.status));

// ---- Call-outs (cl. 2.2, 3, 8.1, 10.2, 12) ----
// Uses an included call-out of the job's site when one is left (then a Gold bonus call-out), otherwise
// the attendance is an additional call-out at $30. Requests are never blocked for having none left.
async function consumeCallout(tx, job, config, at = new Date()) {
  if (job.calloutType === 'INCLUDED' || job.calloutType === 'ADDITIONAL') return {};
  const org = await tx.organization.findUnique({ where: { id: job.organizationId } });
  const location = await tx.location.findUnique({ where: { id: job.locationId } });
  const plan = planFor(config, sitePlanId(location, org));
  const data = { earlyActivation: inWaitingPeriod(org.activationDate, job.submittedAt, config), usedBonusCallout: false };
  if (org.subscriptionStatus === 'SUSPENDED') {
    data.calloutType = 'ADDITIONAL'; // benefits suspended (cl. 4.4)
  } else if ((location?.calloutsUsed || 0) < plan.callouts) {
    data.calloutType = 'INCLUDED';
    await tx.location.update({ where: { id: location.id }, data: { calloutsUsed: { increment: 1 } } });
    await tx.organization.update({ where: { id: org.id }, data: { calloutsUsed: { increment: 1 } } });
  } else if (org.bonusCallouts > 0) {
    data.calloutType = 'INCLUDED';
    data.usedBonusCallout = true;
    await tx.organization.update({ where: { id: org.id }, data: { bonusCallouts: { decrement: 1 } } });
  } else {
    data.calloutType = 'ADDITIONAL';
  }
  await tx.organization.update({ where: { id: org.id }, data: { lastCalloutAt: at } });
  return data;
}

// Gives an included call-out back (quote, decline, reclassified on site, cancelled before dispatch)
async function releaseCallout(tx, job) {
  if (job.calloutType === 'INCLUDED') {
    if (job.usedBonusCallout) {
      await tx.organization.update({ where: { id: job.organizationId }, data: { bonusCallouts: { increment: 1 } } });
    } else {
      const location = await tx.location.findUnique({ where: { id: job.locationId } });
      if (location?.calloutsUsed > 0) await tx.location.update({ where: { id: location.id }, data: { calloutsUsed: { decrement: 1 } } });
      const org = await tx.organization.findUnique({ where: { id: job.organizationId } });
      if (org?.calloutsUsed > 0) await tx.organization.update({ where: { id: org.id }, data: { calloutsUsed: { decrement: 1 } } });
    }
  }
  return { calloutType: 'NONE', usedBonusCallout: false, earlyActivation: false };
}

async function addEvent(tx, job, toStatus, actor, notes) {
  await tx.jobStatusEvent.create({ data: { jobId: job.id, fromStatus: job.status, toStatus, changedByUserId: actor.userId, notes: notes || null } });
}

// A customer always books for their own company; an admin picks the company (hotline booking)
export async function create(actor, body) {
  const organizationId = actor.role === 'CUSTOMER' ? actor.organizationId : body.organizationId;
  if (!organizationId) throw badRequest('Customer company is required.');

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw notFound('Customer company not found.');
  if (org.subscriptionStatus === 'CANCELLED') {
    throw badRequest('This membership has been cancelled. Emergency requests are not available.');
  }
  const config = await getConfig();

  // Use the chosen site if it belongs to this company, otherwise the company's first site
  let location = body.locationId ? await prisma.location.findFirst({ where: { id: body.locationId, organizationId } }) : null;
  if (!location) location = await prisma.location.findFirst({ where: { organizationId }, orderBy: { createdAt: 'asc' } });
  if (!location) {
    location = await prisma.location.create({
      data: {
        organizationId,
        name: body.locationName || 'Primary Site',
        address: body.address || 'Adelaide, SA',
        contactName: body.onsiteContact || body.customerName || 'Onsite Contact',
        contactPhone: body.onsitePhone || '0800000000'
      }
    });
  }

  const plan = planFor(config, sitePlanId(location, org));
  const hazards = Array.isArray(body.hazards) ? body.hazards.filter(h => typeof h === 'string') : [];
  const affectedArea = body.affectedArea !== undefined && body.affectedArea !== '' ? parseFloat(body.affectedArea) : null;
  const waterType = body.waterType || null;
  const category = body.category || 'Other (SACC to assess)';
  const warnings = coverageWarnings({ category, affectedArea, waterType, hazards }, config);

  const source = actor.role === 'ADMIN' ? (body.source || 'HOTLINE') : 'PORTAL';
  const count = await prisma.emergencyRequest.count();
  const jobNumber = `SACC-${new Date().getFullYear()}-${1000 + count + 1}`;

  const newJob = await prisma.$transaction(async (tx) => {
    const job = await tx.emergencyRequest.create({
      data: {
        jobNumber,
        organizationId,
        locationId: location.id,
        customerName: body.customerName || org.businessName,
        locationName: body.locationName || location.name,
        address: body.address || location.address,
        category,
        description: body.description,
        affectedArea: Number.isFinite(affectedArea) ? affectedArea : null,
        waterType,
        hazardsJson: JSON.stringify(hazards),
        coverageWarningsJson: JSON.stringify(warnings),
        incidentTime: body.incidentTime ? new Date(body.incidentTime) : new Date(),
        isOngoing: body.isOngoing !== undefined ? Boolean(body.isOngoing) : true,
        isSafeToAccess: body.isSafeToAccess !== undefined ? Boolean(body.isSafeToAccess) : true,
        onsiteContact: body.onsiteContact,
        onsitePhone: body.onsitePhone,
        accessInstructions: body.accessInstructions,
        accessRestrictions: body.accessRestrictions,
        parkingInstructions: body.parkingInstructions,
        status: 'NEW',
        source,
        submittedAt: new Date(),
        // The response clock starts when SACC acknowledges the request (cl. 13.1), so no target yet
        targetAttendanceAt: null,
        planAtBooking: plan.id,
        priorityTier: org.subscriptionStatus === 'SUSPENDED' ? 4 : plan.priority,
        travelKm: location.serviceArea === 'OUTSIDE_METRO' ? location.travelKm : null,
        photosJson: JSON.stringify(body.photos || []),
        videosJson: JSON.stringify(body.videos || [])
      }
    });
    await tx.jobStatusEvent.create({
      data: { jobId: job.id, fromStatus: '', toStatus: 'NEW', changedByUserId: actor.userId, notes: `Created via ${source}` }
    });
    return job;
  });

  await recordAudit(actor, {
    action: 'JOB_CREATED',
    entityType: 'EmergencyRequest',
    entityId: newJob.id,
    diff: {
      jobNumber, customerName: newJob.customerName, locationName: newJob.locationName, address: newJob.address, category: newJob.category,
      description: newJob.description, affectedArea: newJob.affectedArea, waterType, hazards: hazards.join(', ') || 'None',
      onsiteContact: newJob.onsiteContact, onsitePhone: newJob.onsitePhone, accessInstructions: newJob.accessInstructions, source
    }
  });
  return decorateOne(newJob);
}

// ---- Acknowledge (cl. 13.1, 13.2): starts the response clock ----
function acknowledgeData(job, plan, config, location, at = new Date()) {
  if (job.acknowledgedAt) return {};
  const t = responseTarget(plan, at, config);
  const outside = location?.serviceArea === 'OUTSIDE_METRO'; // no response commitment outside metro (cl. 18.2)
  return {
    acknowledgedAt: at,
    responseClockStartAt: t.clockStart,
    targetWindowFrom: outside ? null : t.from,
    targetAttendanceAt: outside ? null : t.to,
    ...(['NEW', 'SUBMITTED'].includes(job.status) ? { status: 'UNDER_REVIEW' } : {})
  };
}

export async function acknowledge(actor, id) {
  const job = await findJob(id);
  if (job.acknowledgedAt) return decorateOne(job);
  const config = await getConfig();
  const location = await prisma.location.findUnique({ where: { id: job.locationId } });
  const plan = planFor(config, job.planAtBooking);
  const data = acknowledgeData(job, plan, config, location);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.emergencyRequest.update({ where: { id }, data });
    if (data.status) await addEvent(tx, job, data.status, actor, 'Acknowledged by SACC: response clock started');
    return result;
  });
  await recordAudit(actor, { action: 'JOB_ACKNOWLEDGED', entityType: 'EmergencyRequest', entityId: id, diff: changedFields(job, data, ['acknowledgedAt', 'targetAttendanceAt', 'status']) });
  return decorateOne(updated);
}

// ---- Triage (Operations SOP): A covered, B specialist, C excluded, D grey area ----
const TRIAGE_STATUS = { COVERED: 'UNDER_REVIEW', SPECIALIST: 'CONVERTED_TO_QUOTE', EXCLUDED: 'DECLINED', GREY_AREA: 'UNDER_REVIEW' };

export async function triage(actor, id, { outcome, notes, quoteAmount }) {
  if (!TRIAGE_STATUS[outcome]) throw badRequest('Choose covered, specialist, excluded or grey area.');
  const job = await findJob(id);
  if (FINISHED_STATUSES.includes(job.status) && job.status !== 'DECLINED') throw badRequest('This job is already finished.');
  const config = await getConfig();
  const location = await prisma.location.findUnique({ where: { id: job.locationId } });
  const plan = planFor(config, job.planAtBooking);

  const updated = await prisma.$transaction(async (tx) => {
    const data = { ...acknowledgeData(job, plan, config, location), triage: outcome, triageNotes: notes || null, triagedAt: new Date() };
    if (outcome === 'COVERED') Object.assign(data, await consumeCallout(tx, job, config));
    else Object.assign(data, await releaseCallout(tx, job));
    if (outcome === 'SPECIALIST') { data.quoteStatus = 'PENDING'; if (quoteAmount) data.quoteAmount = parseFloat(quoteAmount); }
    // A covered job that is already with a technician keeps its status
    data.status = outcome === 'COVERED' && isDispatched(job) ? job.status : TRIAGE_STATUS[outcome];
    const result = await tx.emergencyRequest.update({ where: { id }, data });
    if (data.status !== job.status) await addEvent(tx, job, data.status, actor, `Triage ${outcome.replace('_', ' ').toLowerCase()}${notes ? `: ${notes}` : ''}`);
    return result;
  });
  await recordAudit(actor, {
    action: 'JOB_TRIAGED', entityType: 'EmergencyRequest', entityId: id,
    diff: changedFields(job, updated, ['triage', 'triageNotes', 'status', 'calloutType', 'earlyActivation', 'quoteAmount', 'acknowledgedAt'])
  });
  return decorateOne(updated);
}

// ---- Quote decision (cl. 10.2): accepted work is charged at the quote and uses no call-out ----
export async function decideQuote(actor, id, { decision, quoteAmount }) {
  if (!['ACCEPTED', 'DECLINED'].includes(decision)) throw badRequest('Decision must be ACCEPTED or DECLINED.');
  const job = await findJob(id);
  assertOrganizationAccess(actor, job.organizationId);
  if (job.quoteStatus !== 'PENDING') throw badRequest('There is no quote waiting for a decision on this job.');
  const amount = quoteAmount !== undefined && actor.role === 'ADMIN' ? parseFloat(quoteAmount) : job.quoteAmount;
  if (decision === 'ACCEPTED' && !amount) throw badRequest('SACC has not priced this quote yet.');
  const onSite = Boolean(job.reclassifyReason);
  const status = decision === 'DECLINED' ? 'CLOSED' : onSite ? 'ARRIVED' : 'UNDER_REVIEW';
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.emergencyRequest.update({ where: { id }, data: { quoteStatus: decision, quoteAmount: amount, status } });
    await addEvent(tx, job, status, actor, `Quote ${decision.toLowerCase()}`);
    if (decision === 'DECLINED') await syncTechnicians(tx, job, result, status);
    return result;
  });
  await recordAudit(actor, { action: 'JOB_QUOTE_DECIDED', entityType: 'EmergencyRequest', entityId: id, diff: { quoteStatus: { from: 'PENDING', to: decision }, quoteAmount: amount, status: { from: job.status, to: status } } });
  return decorateOne(updated);
}

// ---- Customer cancels (cl. 12.5): free before dispatch; after dispatch the call-out is used and $100 applies ----
export async function cancel(actor, id) {
  const job = await findJob(id);
  assertOrganizationAccess(actor, job.organizationId);
  if (FINISHED_STATUSES.includes(job.status) || ['IN_PROGRESS', 'UNABLE_TO_ACCESS'].includes(job.status)) throw badRequest('This request can no longer be cancelled.');
  const config = await getConfig();
  const dispatched = isDispatched(job);
  const updated = await prisma.$transaction(async (tx) => {
    const data = { status: 'CANCELLED', cancelledAt: new Date() };
    if (dispatched) {
      Object.assign(data, await consumeCallout(tx, job, config), { cancellationFee: config.lateCancellationFee ?? 100 });
    } else {
      Object.assign(data, await releaseCallout(tx, job));
    }
    const result = await tx.emergencyRequest.update({ where: { id }, data });
    await addEvent(tx, job, 'CANCELLED', actor, dispatched ? `Cancelled after dispatch: call-out used and $${data.cancellationFee} fee` : 'Cancelled before dispatch: no fee');
    await syncTechnicians(tx, job, result, 'CANCELLED');
    return result;
  });
  await recordAudit(actor, { action: 'JOB_CANCELLED', entityType: 'EmergencyRequest', entityId: id, diff: { status: { from: job.status, to: 'CANCELLED' }, cancellationFee: updated.cancellationFee, calloutType: updated.calloutType } });
  return decorateOne(updated);
}

// EDIT EMERGENCY REQUEST (Allowed only before SACC has acknowledged it)
export async function edit(actor, id, body) {
  const existing = await findJob(id);
  assertOrganizationAccess(actor, existing.organizationId);
  if (!['NEW', 'SUBMITTED'].includes(existing.status) || (existing.acknowledgedAt && actor.role === 'CUSTOMER')) {
    throw badRequest('Cannot edit request: SACC has already acknowledged or dispatched it. Please call the hotline with changes.');
  }

  const pick = (field) => (body[field] !== undefined ? body[field] : existing[field]);
  const hazards = Array.isArray(body.hazards) ? body.hazards : parseList(existing.hazardsJson);
  const data = {
    category: pick('category'),
    description: pick('description'),
    affectedArea: body.affectedArea !== undefined ? (body.affectedArea === '' ? null : parseFloat(body.affectedArea)) : existing.affectedArea,
    waterType: pick('waterType'),
    hazardsJson: JSON.stringify(hazards),
    incidentTime: body.incidentTime ? new Date(body.incidentTime) : existing.incidentTime,
    isOngoing: body.isOngoing !== undefined ? Boolean(body.isOngoing) : existing.isOngoing,
    isSafeToAccess: body.isSafeToAccess !== undefined ? Boolean(body.isSafeToAccess) : existing.isSafeToAccess,
    onsiteContact: pick('onsiteContact'),
    onsitePhone: pick('onsitePhone'),
    accessInstructions: pick('accessInstructions'),
    accessRestrictions: pick('accessRestrictions'),
    parkingInstructions: pick('parkingInstructions'),
    photosJson: body.photos ? JSON.stringify(body.photos) : existing.photosJson,
    videosJson: body.videos ? JSON.stringify(body.videos) : existing.videosJson
  };
  data.coverageWarningsJson = JSON.stringify(coverageWarnings({ ...data, hazards }, await getConfig()));

  const updated = await prisma.emergencyRequest.update({ where: { id }, data });

  const diff = changedFields(existing, data, EDITABLE_FIELDS);
  if (data.hazardsJson !== existing.hazardsJson) diff.hazards = { from: parseList(existing.hazardsJson).join(', '), to: hazards.join(', ') };
  if (data.photosJson !== existing.photosJson) diff.photos = 'changed';
  if (data.videosJson !== existing.videosJson) diff.videos = 'changed';
  await recordAudit(actor, { action: 'JOB_EDITED', entityType: 'EmergencyRequest', entityId: updated.id, diff });
  return decorateOne(updated);
}

// Keep the technician roster in step with the job
async function syncTechnicians(tx, job, updated, newStatus, technicianName) {
  const techName = updated.technicianName;
  if (techName && techName !== 'Unassigned') {
    const tech = await tx.technician.findFirst({ where: { name: techName } });
    if (tech) {
      if (FINISHED_STATUSES.includes(newStatus) || ['UNABLE_TO_ACCESS', 'CONVERTED_TO_QUOTE'].includes(newStatus)) {
        if (tech.activeJobId === job.jobNumber || tech.activeJobId === job.id) {
          await tx.technician.update({ where: { id: tech.id }, data: { status: tech.status === 'OFF_DUTY' ? 'OFF_DUTY' : 'AVAILABLE', activeJobId: null } });
        }
      } else {
        // Keep a technician who is marked off duty off duty; "on a job" is worked out from jobs when listing
        await tx.technician.update({ where: { id: tech.id }, data: { ...(tech.status === 'OFF_DUTY' ? {} : { status: 'ON_SITE' }), activeJobId: job.jobNumber } });
      }
    }
  }
  // Re-assigned: free the previous technician
  if (technicianName !== undefined && job.technicianName && job.technicianName !== technicianName) {
    const prev = await tx.technician.findFirst({ where: { name: job.technicianName } });
    if (prev && (prev.activeJobId === job.jobNumber || prev.activeJobId === job.id)) {
      await tx.technician.update({ where: { id: prev.id }, data: { status: 'AVAILABLE', activeJobId: null } });
    }
  }
}

// STATUS CHANGES: admin can set any status; a technician moves only their own job, one step at a time.
// Every change is stored in JobStatusEvent, which the service report timeline is built from.
export async function changeStatus(actor, id, { status, technicianName, notes }) {
  const job = await findJob(id);
  const newStatus = status || job.status;

  if (actor.role === 'TECHNICIAN') {
    if (technicianName !== undefined) throw forbidden('Only the admin desk can assign technicians.');
    if (!(await isJobAssignedToTechnician(actor, job))) throw forbidden('This job is not assigned to you.');
    if (!canTechnicianMove(job.status, newStatus)) throw badRequest(`A job in ${job.status} cannot move to ${newStatus}.`);
    const missing = onSiteMissing(job, newStatus);
    if (missing) throw badRequest(missing);
  }
  if (job.status === 'CONVERTED_TO_QUOTE' && job.quoteStatus === 'PENDING' && !['DECLINED', 'CLOSED', 'CANCELLED'].includes(newStatus)) {
    throw badRequest('This job is waiting for the member to accept or decline the quote.');
  }

  const config = await getConfig();
  const now = new Date();
  const updateData = { status: newStatus };
  if (technicianName !== undefined) updateData.technicianName = technicianName;

  // Arrival is the attendance: the $50 surcharge depends on when it happens (cl. 7)
  if (newStatus === 'ARRIVED' && job.status !== 'ARRIVED' && !job.surchargeAmount) {
    const s = surchargeFor(planFor(config, job.planAtBooking), now, config);
    updateData.surchargeAmount = s.amount;
    updateData.surchargeReason = s.reason;
  }
  // Labour time comes from the server clock, not from the browser
  if (newStatus === 'IN_PROGRESS' && !job.workStartedAt) {
    updateData.workStartedAt = now;
    updateData.timerActive = true;
  }
  if (newStatus === 'COMPLETED') {
    updateData.completedAt = now;
    updateData.timerActive = false;
    if (job.workStartedAt) updateData.timerMinutes = Math.max(1, Math.round((now - new Date(job.workStartedAt)) / 60000));
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Assigning a technician to a request nobody has triaged: SACC has accepted it as covered (SOP)
    if (technicianName && !job.triage) {
      const location = await tx.location.findUnique({ where: { id: job.locationId } });
      Object.assign(updateData, acknowledgeData(job, planFor(config, job.planAtBooking), config, location, now), { status: newStatus, triage: 'COVERED', triagedAt: now }, await consumeCallout(tx, job, config, now));
    }
    if (newStatus === 'CANCELLED' && !job.cancelledAt) {
      updateData.cancelledAt = now; // cancelled by SACC: no fee, call-out given back
      Object.assign(updateData, await releaseCallout(tx, job));
    }
    const result = await tx.emergencyRequest.update({ where: { id: job.id }, data: updateData });
    if (newStatus !== job.status || technicianName !== undefined) {
      await tx.jobStatusEvent.create({
        data: {
          jobId: job.id,
          fromStatus: job.status,
          toStatus: newStatus,
          changedByUserId: actor.userId,
          notes: notes || (technicianName !== undefined ? `Assigned to ${technicianName}` : null)
        }
      });
    }
    await syncTechnicians(tx, job, result, newStatus, technicianName);
    return result;
  });

  await recordAudit(actor, {
    action: technicianName !== undefined ? 'JOB_ASSIGNED' : 'JOB_STATUS_CHANGED',
    entityType: 'EmergencyRequest',
    entityId: job.id,
    diff: changedFields(job, updateData, ['status', 'technicianName', 'workStartedAt', 'completedAt', 'timerMinutes', 'surchargeAmount', 'calloutType'])
  });
  return decorateOne(updated);
}

// ---- On-site record (SOP, Service Report Template): photos, measurements, disposal, sign-off ----
const SITE_TEXT = ['causeOfIncident', 'surfacesAffected', 'methodUsed', 'equipmentUsed', 'productsUsed', 'equipmentLeft', 'recommendations', 'siteRepName'];
const STAFF_ONLY = ['travelKm', 'otherCharges', 'otherChargesNote'];

export async function updateSiteRecord(actor, id, body) {
  const job = await findJob(id);
  if (actor.role === 'TECHNICIAN' && !(await isJobAssignedToTechnician(actor, job))) throw forbidden('This job is not assigned to you.');
  if (job.reportIssuedAt) throw badRequest('The service report has been issued; this job can no longer be changed.');
  const data = {};
  for (const f of SITE_TEXT) if (body[f] !== undefined) data[f] = body[f] ? String(body[f]).slice(0, 4000) : null;
  if (body.measuredArea !== undefined) data.measuredArea = body.measuredArea === '' || body.measuredArea === null ? null : parseFloat(body.measuredArea);
  if (body.technicianCount !== undefined) data.technicianCount = Math.max(1, Math.min(10, parseInt(body.technicianCount, 10) || 1));
  if (body.equipmentCollectionAt !== undefined) data.equipmentCollectionAt = body.equipmentCollectionAt ? new Date(body.equipmentCollectionAt) : null;
  if (Array.isArray(body.beforePhotos)) data.beforePhotosJson = JSON.stringify(body.beforePhotos.slice(0, 12));
  if (Array.isArray(body.afterPhotos)) data.afterPhotosJson = JSON.stringify(body.afterPhotos.slice(0, 12));
  if (Array.isArray(body.disposal)) data.disposalJson = JSON.stringify(body.disposal.filter(d => d && d.item).map(d => ({ item: String(d.item).slice(0, 120), cost: Math.max(0, Number(d.cost) || 0) })));
  if (body.checklist && typeof body.checklist === 'object') data.checklistJson = JSON.stringify(body.checklist);
  if (body.siteRepSignature !== undefined) {
    data.siteRepSignature = body.siteRepSignature || null;
    data.signedOffAt = body.siteRepSignature ? new Date() : null;
  }
  if (actor.role === 'ADMIN') {
    if (body.travelKm !== undefined) data.travelKm = body.travelKm === '' || body.travelKm === null ? null : parseFloat(body.travelKm);
    if (body.otherCharges !== undefined) data.otherCharges = Math.max(0, parseFloat(body.otherCharges) || 0);
    if (body.otherChargesNote !== undefined) data.otherChargesNote = body.otherChargesNote || null;
  } else if (STAFF_ONLY.some(f => body[f] !== undefined)) {
    throw forbidden('Only the admin desk can change travel or other charges.');
  }
  const updated = await prisma.emergencyRequest.update({ where: { id }, data });
  const diff = changedFields(job, data, [...SITE_TEXT, 'measuredArea', 'technicianCount', 'equipmentCollectionAt', 'travelKm', 'otherCharges', 'otherChargesNote', 'signedOffAt']);
  for (const k of ['beforePhotosJson', 'afterPhotosJson', 'disposalJson', 'checklistJson']) if (data[k] !== undefined && data[k] !== job[k]) diff[k.replace('Json', '')] = 'changed';
  if (Object.keys(diff).length) await recordAudit(actor, { action: 'JOB_SITE_RECORD_UPDATED', entityType: 'EmergencyRequest', entityId: id, diff });
  return decorateOne(updated);
}

// ---- Reclassified on arrival (cl. 10.2): quote before any work, no call-out used ----
export async function reclassify(actor, id, { reason, quoteAmount }) {
  const job = await findJob(id);
  if (actor.role === 'TECHNICIAN' && !(await isJobAssignedToTechnician(actor, job))) throw forbidden('This job is not assigned to you.');
  if (!['ARRIVED', 'IN_PROGRESS'].includes(job.status)) throw badRequest('A job can be reclassified once the technician is on site.');
  if (!reason || String(reason).trim().length < 5) throw badRequest('Explain why the job is outside the membership cover.');
  const updated = await prisma.$transaction(async (tx) => {
    const data = { ...(await releaseCallout(tx, job)), status: 'CONVERTED_TO_QUOTE', triage: 'SPECIALIST', reclassifyReason: String(reason).trim(), quoteStatus: 'PENDING', ...(quoteAmount ? { quoteAmount: parseFloat(quoteAmount) } : {}) };
    const result = await tx.emergencyRequest.update({ where: { id }, data });
    await addEvent(tx, job, 'CONVERTED_TO_QUOTE', actor, `Reclassified on site: ${data.reclassifyReason}`);
    return result;
  });
  await recordAudit(actor, { action: 'JOB_RECLASSIFIED', entityType: 'EmergencyRequest', entityId: id, diff: { status: { from: job.status, to: 'CONVERTED_TO_QUOTE' }, reclassifyReason: updated.reclassifyReason, quoteAmount: updated.quoteAmount, calloutType: { from: job.calloutType, to: 'NONE' } } });
  return decorateOne(updated);
}

// ---- Missed access (cl. 12.4, SOP): wait 15 minutes, 2 calls, photo of the entrance ----
export async function missedAccess(actor, id, { calls, entrancePhoto, notes }) {
  const job = await findJob(id, { statusEvents: { where: { toStatus: 'ARRIVED' }, orderBy: { createdAt: 'asc' } } });
  if (actor.role === 'TECHNICIAN' && !(await isJobAssignedToTechnician(actor, job))) throw forbidden('This job is not assigned to you.');
  if (job.status !== 'ARRIVED') throw badRequest('Missed access is recorded after arriving at the site.');
  const config = await getConfig();
  const arrivedAt = job.statusEvents[0]?.createdAt || new Date();
  const waited = Math.floor((Date.now() - new Date(arrivedAt)) / 60000);
  const needWait = config.missedAccessWaitMinutes ?? 15;
  if (actor.role === 'TECHNICIAN' && waited < needWait) throw badRequest(`Wait ${needWait} minutes on site before recording missed access (${needWait - waited} min to go).`);
  if ((Number(calls) || 0) < (config.missedAccessCalls ?? 2)) throw badRequest(`Call the site contact at least ${config.missedAccessCalls ?? 2} times first.`);
  if (!entrancePhoto) throw badRequest('Take a photo of the entrance.');
  const updated = await prisma.$transaction(async (tx) => {
    const data = { ...(await consumeCallout(tx, job, config)), status: 'UNABLE_TO_ACCESS', missedAccessAt: new Date(), missedAccessJson: JSON.stringify({ waitedMinutes: waited, calls: Number(calls), entrancePhoto, notes: notes || null }) };
    const result = await tx.emergencyRequest.update({ where: { id }, data });
    await addEvent(tx, job, 'UNABLE_TO_ACCESS', actor, `No access after ${waited} min and ${calls} calls`);
    await syncTechnicians(tx, job, result, 'UNABLE_TO_ACCESS');
    return result;
  });
  await recordAudit(actor, { action: 'JOB_MISSED_ACCESS', entityType: 'EmergencyRequest', entityId: id, diff: { status: { from: job.status, to: 'UNABLE_TO_ACCESS' }, waitedMinutes: waited, calls: Number(calls), fee: config.missedAccessFee ?? 100 } });
  return decorateOne(updated);
}

// ---- Issue the service report (cl. 16, SOP): report number, frozen charges, extras invoice with 7-day terms ----
const REPORTABLE = ['COMPLETED', 'UNABLE_TO_ACCESS', 'CANCELLED', 'CLOSED'];

export async function issueReport(actor, id) {
  const job = await findJob(id);
  if (job.reportIssuedAt) throw badRequest(`Report ${job.reportNumber} was already issued.`);
  if (!REPORTABLE.includes(job.status)) throw badRequest('The report is issued once the job is completed (or access was missed).');
  const config = await getConfig();
  const org = await prisma.organization.findUnique({ where: { id: job.organizationId } });
  const charges = jobCharges(job, planFor(config, job.planAtBooking), config, ratesFor(org, config, job.planAtBooking));
  const year = new Date().getFullYear();
  const updated = await prisma.$transaction(async (tx) => {
    const issued = await tx.emergencyRequest.count({ where: { reportNumber: { startsWith: `SR-${year}-` } } });
    const reportNumber = `SR-${year}-${String(issued + 1).padStart(4, '0')}`;
    let invoiceId = null;
    if (charges.subtotal > 0) {
      const count = await tx.invoice.count();
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: `INV-${year}-${1000 + count + 1}`,
          organizationId: job.organizationId,
          kind: 'EXTRAS',
          jobId: job.id,
          description: `Emergency attendance extras: ${job.jobNumber} (report ${reportNumber})`,
          amount: charges.subtotal,
          gst: charges.gst,
          linesJson: JSON.stringify(charges.lines),
          status: 'PENDING',
          paymentMethod: org.paymentMethod,
          dueDate: new Date(Date.now() + (config.extrasPaymentTermsDays ?? 7) * 86400000),
          paidAt: null
        }
      });
      invoiceId = invoice.id;
    }
    const data = { reportNumber, reportIssuedAt: new Date(), chargesJson: JSON.stringify(charges), extrasInvoiceId: invoiceId, ...(job.status === 'COMPLETED' ? { status: 'REPORT_ISSUED' } : {}) };
    const result = await tx.emergencyRequest.update({ where: { id }, data });
    if (data.status) await addEvent(tx, job, 'REPORT_ISSUED', actor, `Report ${reportNumber} issued`);
    return result;
  });
  await recordAudit(actor, { action: 'REPORT_ISSUED', entityType: 'EmergencyRequest', entityId: id, diff: { reportNumber: updated.reportNumber, total: charges.subtotal, invoice: updated.extrasInvoiceId ? 'created' : 'none needed' } });
  return decorateOne(updated);
}

// ---- Goodwill credit (cl. 13.5): 50 points when SACC arrived more than 4 hours after the clock started ----
export async function goodwill(actor, id) {
  const job = await findJob(id, { statusEvents: { where: { toStatus: 'ARRIVED' }, orderBy: { createdAt: 'asc' } } });
  if (job.goodwillCredited) throw badRequest('The goodwill credit was already given for this job.');
  const arrivedAt = job.statusEvents[0]?.createdAt;
  if (!job.targetAttendanceAt || !arrivedAt || new Date(arrivedAt) <= new Date(job.targetAttendanceAt)) throw badRequest('This job was attended within the 4-hour target.');
  const config = await getConfig();
  await prisma.$transaction(async (tx) => {
    await creditPoints(tx, job.organizationId, config.goodwillPoints ?? 50, 'GOODWILL', `Late attendance ${job.jobNumber}`, config);
    await tx.emergencyRequest.update({ where: { id }, data: { goodwillCredited: true } });
  });
  await recordAudit(actor, { action: 'GOODWILL_CREDITED', entityType: 'EmergencyRequest', entityId: id, diff: { points: config.goodwillPoints ?? 50, jobNumber: job.jobNumber } });
  return decorateOne(await findJob(id));
}

// ---- Workmanship guarantee (cl. 20): report within 24 hours, SACC re-attends at no cost ----
export async function reattend(actor, id, { description }) {
  const job = await findJob(id);
  assertOrganizationAccess(actor, job.organizationId);
  const config = await getConfig();
  const hours = config.workmanshipNoticeHours ?? 24;
  if (!job.completedAt) throw badRequest('Only a completed job can be re-attended.');
  if (Date.now() - new Date(job.completedAt) > hours * 3600000 && actor.role === 'CUSTOMER') throw badRequest(`Workmanship issues must be reported within ${hours} hours of completion. Please call the hotline.`);
  if (await prisma.emergencyRequest.findFirst({ where: { reattendOfId: job.id } })) throw badRequest('A re-attend has already been booked for this job.');
  if (!description || String(description).trim().length < 5) throw badRequest('Tell us what was not right.');
  const count = await prisma.emergencyRequest.count();
  const created = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const r = await tx.emergencyRequest.create({
      data: {
        jobNumber: `SACC-${now.getFullYear()}-${1000 + count + 1}`, organizationId: job.organizationId, locationId: job.locationId,
        customerName: job.customerName, locationName: job.locationName, address: job.address, category: job.category,
        description: `Workmanship re-attend for ${job.jobNumber}: ${String(description).trim()}`, onsiteContact: job.onsiteContact, onsitePhone: job.onsitePhone,
        accessInstructions: job.accessInstructions, status: 'UNDER_REVIEW', source: actor.role === 'CUSTOMER' ? 'PORTAL' : 'HOTLINE', submittedAt: now,
        acknowledgedAt: now, triage: 'COVERED', triagedAt: now, calloutType: 'NONE', planAtBooking: job.planAtBooking, priorityTier: job.priorityTier, reattendOfId: job.id
      }
    });
    await tx.jobStatusEvent.create({ data: { jobId: r.id, fromStatus: '', toStatus: 'UNDER_REVIEW', changedByUserId: actor.userId, notes: `Workmanship guarantee re-attend of ${job.jobNumber}` } });
    return r;
  });
  await recordAudit(actor, { action: 'JOB_REATTEND_REQUESTED', entityType: 'EmergencyRequest', entityId: created.id, diff: { jobNumber: created.jobNumber, reattendOf: job.jobNumber, description: created.description } });
  return decorateOne(created);
}

export async function resetAll(actor) {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.jobStatusEvent.deleteMany({});
    const result = await tx.emergencyRequest.deleteMany({});
    await tx.organization.updateMany({ data: { calloutsUsed: 0 } });
    await tx.location.updateMany({ data: { calloutsUsed: 0 } });
    await tx.technician.updateMany({ data: { status: 'AVAILABLE', activeJobId: null } });
    return result;
  });
  await recordAudit(actor, { action: 'JOBS_RESET', entityType: 'EmergencyRequest', diff: { deleted: deleted.count } });
  return { message: 'All emergency requests successfully cleared and callout counts reset to 0.', count: deleted.count };
}

// Extra time on site: the assigned technician asks for it, only the admin desk approves it.
// The cost is worked out from the time on site at the member's plan rate (cl. 8.3), not entered by hand.
export async function updateExtension(actor, id, body) {
  const job = await findJob(id);
  if (actor.role === 'TECHNICIAN' && !(await isJobAssignedToTechnician(actor, job))) {
    throw forbidden('This job is not assigned to you.');
  }
  const { extensionRequested, extensionApproved } = body;
  const data = {
    extensionRequested: extensionRequested !== undefined ? Boolean(extensionRequested) : true,
    extensionApproved: actor.role === 'ADMIN' && extensionApproved !== undefined ? Boolean(extensionApproved) : job.extensionApproved
  };
  const updated = await prisma.emergencyRequest.update({ where: { id }, data });
  await recordAudit(actor, {
    action: 'JOB_EXTENSION_UPDATED',
    entityType: 'EmergencyRequest',
    entityId: job.id,
    diff: changedFields(job, data, ['extensionRequested', 'extensionApproved'])
  });
  return decorateOne(updated);
}
