import { prisma } from '../../db/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/httpError.js';
import { recordAudit, changedFields } from '../../lib/audit.js';
import { assertOrganizationAccess, organizationScope, isJobAssignedToTechnician, jobScope } from '../../lib/access.js';
import { parseJob } from '../../lib/jobs.js';
import { allowedCallouts } from '../../../shared/config.js';
import { FINISHED_STATUSES, canTechnicianMove } from '../../../shared/jobStatus.js';

const SLA_HOURS = 3;
const EDITABLE_FIELDS = [
  'category', 'description', 'affectedArea', 'incidentTime', 'isOngoing', 'isSafeToAccess', 'onsiteContact',
  'onsitePhone', 'accessInstructions', 'accessRestrictions', 'parkingInstructions'
];

async function findJob(id, include) {
  const job = await prisma.emergencyRequest.findUnique({ where: { id }, include });
  if (!job) throw notFound('Emergency request job not found.');
  return job;
}

export async function list(actor) {
  const jobs = await prisma.emergencyRequest.findMany({ where: await jobScope(actor), orderBy: { submittedAt: 'desc' } });
  return jobs.map(parseJob);
}

// One job with its full status timeline (used by the PDF download and job details)
export async function get(actor, id) {
  const job = await findJob(id, { statusEvents: { orderBy: { createdAt: 'asc' } } });
  assertOrganizationAccess(actor, job.organizationId);
  return parseJob(job);
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

  const planId = org.membershipPlan || 'business';
  const allowed = allowedCallouts(planId);
  if (org.calloutsUsed >= allowed) {
    throw badRequest(`Call-out Limit Exhausted: You have used all ${org.calloutsUsed} of ${allowed} call-out(s) for your ${planId.toUpperCase()} membership plan. Please upgrade your plan to request additional emergency cleanings.`);
  }

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
        category: body.category || 'General Hazard',
        description: body.description,
        affectedArea: parseFloat(body.affectedArea) || 25,
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
        targetAttendanceAt: new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000),
        photosJson: JSON.stringify(body.photos || []),
        videosJson: JSON.stringify(body.videos || [])
      }
    });
    await tx.jobStatusEvent.create({
      data: { jobId: job.id, fromStatus: '', toStatus: 'NEW', changedByUserId: actor.userId, notes: `Created via ${source}` }
    });
    await tx.organization.update({ where: { id: organizationId }, data: { calloutsUsed: { increment: 1 } } });
    return job;
  });

  await recordAudit(actor, {
    action: 'JOB_CREATED',
    entityType: 'EmergencyRequest',
    entityId: newJob.id,
    diff: {
      jobNumber, customerName: newJob.customerName, locationName: newJob.locationName, address: newJob.address, category: newJob.category,
      description: newJob.description, affectedArea: newJob.affectedArea, onsiteContact: newJob.onsiteContact, onsitePhone: newJob.onsitePhone,
      accessInstructions: newJob.accessInstructions, source
    }
  });
  return parseJob(newJob);
}

// EDIT EMERGENCY REQUEST (Allowed only when status is NEW or SUBMITTED)
export async function edit(actor, id, body) {
  const existing = await findJob(id);
  assertOrganizationAccess(actor, existing.organizationId);
  if (!['NEW', 'SUBMITTED'].includes(existing.status)) {
    throw badRequest('Cannot edit request: Job has already been accepted or dispatched by admin operations.');
  }

  const pick = (field) => (body[field] !== undefined ? body[field] : existing[field]);
  const data = {
    category: pick('category'),
    description: pick('description'),
    affectedArea: body.affectedArea !== undefined ? parseFloat(body.affectedArea) : existing.affectedArea,
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

  const updated = await prisma.emergencyRequest.update({ where: { id }, data });

  const diff = changedFields(existing, data, EDITABLE_FIELDS);
  if (data.photosJson !== existing.photosJson) diff.photos = 'changed';
  if (data.videosJson !== existing.videosJson) diff.videos = 'changed';
  await recordAudit(actor, { action: 'JOB_EDITED', entityType: 'EmergencyRequest', entityId: updated.id, diff });
  return parseJob(updated);
}

// Keep the technician roster in step with the job
async function syncTechnicians(tx, job, updated, newStatus, technicianName) {
  const techName = updated.technicianName;
  if (techName && techName !== 'Unassigned') {
    const tech = await tx.technician.findFirst({ where: { name: techName } });
    if (tech) {
      if (FINISHED_STATUSES.includes(newStatus)) {
        if (tech.activeJobId === job.jobNumber || tech.activeJobId === job.id) {
          await tx.technician.update({ where: { id: tech.id }, data: { status: 'AVAILABLE', activeJobId: null } });
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
  }

  const now = new Date();
  const updateData = { status: newStatus };
  if (technicianName !== undefined) updateData.technicianName = technicianName;

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
    diff: changedFields(job, updateData, ['status', 'technicianName', 'workStartedAt', 'completedAt', 'timerMinutes'])
  });
  return parseJob(updated);
}

export async function resetAll(actor) {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.jobStatusEvent.deleteMany({});
    const result = await tx.emergencyRequest.deleteMany({});
    await tx.organization.updateMany({ data: { calloutsUsed: 0 } });
    await tx.technician.updateMany({ data: { status: 'AVAILABLE', activeJobId: null } });
    return result;
  });
  await recordAudit(actor, { action: 'JOBS_RESET', entityType: 'EmergencyRequest', diff: { deleted: deleted.count } });
  return { message: 'All emergency requests successfully cleared and callout counts reset to 0.', count: deleted.count };
}

// Overage extension: the assigned technician requests it, only the admin desk approves it
export async function updateExtension(actor, id, body) {
  const job = await findJob(id);
  if (actor.role === 'TECHNICIAN' && !(await isJobAssignedToTechnician(actor, job))) {
    throw forbidden('This job is not assigned to you.');
  }
  const { extensionRequested, extensionApproved, additionalCharges } = body;
  const data = {
    extensionRequested: extensionRequested !== undefined ? extensionRequested : true,
    extensionApproved: actor.role === 'ADMIN' && extensionApproved !== undefined ? extensionApproved : job.extensionApproved,
    additionalCharges: additionalCharges ? parseFloat(additionalCharges) : 120.00
  };
  const updated = await prisma.emergencyRequest.update({ where: { id }, data });
  await recordAudit(actor, {
    action: 'JOB_EXTENSION_UPDATED',
    entityType: 'EmergencyRequest',
    entityId: job.id,
    diff: changedFields(job, data, ['extensionRequested', 'extensionApproved', 'additionalCharges'])
  });
  return parseJob(updated);
}
