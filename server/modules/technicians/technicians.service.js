import { prisma } from '../../db/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/httpError.js';
import { recordAudit, changedFields } from '../../lib/audit.js';
import { isOwnTechnician, technicianNameMatches } from '../../lib/access.js';
import { hashPassword, generateTempPassword, randomDigits } from '../../lib/passwords.js';
import { FINISHED_STATUSES, COMPLETED_STATUSES, TECHNICIAN_STATES } from '../../../shared/jobStatus.js';

async function findTechnician(id) {
  const tech = await prisma.technician.findUnique({ where: { id } });
  if (!tech) throw notFound('Technician not found');
  return tech;
}

// Jobs store the technician's name, so open jobs follow a rename
const renameOnOpenJobs = (tx, oldName, newName) => tx.emergencyRequest.updateMany({
  where: { technicianName: oldName, status: { notIn: FINISHED_STATUSES } },
  data: { technicianName: newName }
});

// Statuses where the technician is out working on the job
const WORKING_STATUSES = ['ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'];

// The roster with each technician's status worked out from their jobs in the database, so it can't drift.
// OFF_DUTY is the only status set by hand; otherwise a technician with a job under way is ON_SITE.
export async function list() {
  const [technicians, jobs] = await Promise.all([
    prisma.technician.findMany({ include: { user: { select: { email: true, lastLoginAt: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.emergencyRequest.findMany({
      where: { technicianName: { not: null } },
      select: { id: true, jobNumber: true, status: true, technicianName: true, completedAt: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' }
    })
  ]);
  const today = new Date().toDateString();
  return technicians.map(({ user, ...t }) => {
    const mine = jobs.filter(j => technicianNameMatches(j.technicianName, t.name));
    const open = mine.filter(j => !FINISHED_STATUSES.includes(j.status));
    const working = open.filter(j => WORKING_STATUSES.includes(j.status));
    const done = mine.filter(j => COMPLETED_STATUSES.includes(j.status));
    const status = t.status === 'OFF_DUTY' ? 'OFF_DUTY' : working.length ? 'ON_SITE' : 'AVAILABLE';
    return {
      ...t,
      dutyStatus: t.status,
      status,
      activeJobId: (working[0] || open[0])?.jobNumber || null,
      activeJobRef: (working[0] || open[0])?.id || null,
      workingJobs: working.length,
      waitingJobs: open.length - working.length,
      completedJobs: done.length,
      completedToday: done.filter(j => new Date(j.completedAt || j.submittedAt).toDateString() === today).length,
      email: user?.email || null,
      lastLoginAt: user?.lastLoginAt || null
    };
  });
}

// Create technician + login. A random temporary password is returned once for the admin to pass on.
export async function create(actor, body) {
  const name = body.name.trim();
  if (await prisma.technician.findFirst({ where: { name } })) {
    throw badRequest('A technician with this name already exists. Jobs are assigned by name, so names must be unique.');
  }

  const techEmail = body.email
    ? body.email
    : `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}.${randomDigits()}@sacleaning.com.au`;
  if (await prisma.user.findUnique({ where: { email: techEmail } })) {
    throw badRequest('An account with this email address already exists.');
  }

  const tempPassword = body.password || generateTempPassword();
  const hashedPassword = await hashPassword(tempPassword);

  const { tech, user } = await prisma.$transaction(async (tx) => {
    const tech = await tx.technician.create({
      data: { name, phone: body.phone.trim(), status: body.status || 'AVAILABLE', rating: parseFloat(body.rating) || 5.0 }
    });
    const user = await tx.user.create({
      data: { email: techEmail, password: hashedPassword, name, role: 'TECHNICIAN', technicianId: tech.id }
    });
    return { tech, user };
  });

  await recordAudit(actor, { action: 'TECHNICIAN_CREATED', entityType: 'Technician', entityId: tech.id, diff: { name: tech.name, phone: tech.phone, email: user.email, status: tech.status, rating: tech.rating } });
  return { ...tech, email: user.email, userId: user.id, tempPassword: body.password ? undefined : tempPassword };
}

// Admin edits a technician
export async function update(actor, id, { name, phone, status, rating }) {
  const before = await findTechnician(id);
  if (status && !TECHNICIAN_STATES.includes(status)) throw badRequest('Status must be AVAILABLE, ON_SITE or OFF_DUTY.');
  const data = {
    ...(name ? { name: name.trim() } : {}),
    ...(phone ? { phone } : {}),
    ...(status ? { status } : {}),
    ...(rating !== undefined ? { rating: parseFloat(rating) } : {})
  };
  const tech = await prisma.$transaction(async (tx) => {
    const tech = await tx.technician.update({ where: { id }, data });
    if (data.name) {
      await tx.user.updateMany({ where: { technicianId: id }, data: { name: data.name } });
      if (data.name !== before.name) await renameOnOpenJobs(tx, before.name, data.name);
    }
    return tech;
  });
  await recordAudit(actor, { action: 'TECHNICIAN_UPDATED', entityType: 'Technician', entityId: tech.id, diff: changedFields(before, data, ['name', 'phone', 'status', 'rating']) });
  return tech;
}

// Technician (or admin) updates name, phone and password
export async function updateProfile(actor, id, { name, phone, password }) {
  if (!isOwnTechnician(actor, id)) throw forbidden();
  const before = await findTechnician(id);

  const tech = await prisma.$transaction(async (tx) => {
    const tech = await tx.technician.update({
      where: { id },
      data: { ...(name ? { name: name.trim() } : {}), ...(phone ? { phone } : {}) }
    });
    const userData = {};
    if (password && password.trim()) userData.password = await hashPassword(password.trim());
    if (name) userData.name = name.trim();
    if (Object.keys(userData).length) await tx.user.updateMany({ where: { technicianId: id }, data: userData });
    if (name && name.trim() !== before.name) await renameOnOpenJobs(tx, before.name, name.trim());
    return tech;
  });

  const diff = changedFields(before, { name: name?.trim(), phone }, ['name', 'phone']);
  if (password) diff.password = 'changed';
  await recordAudit(actor, { action: 'TECHNICIAN_PROFILE_UPDATED', entityType: 'Technician', entityId: tech.id, diff });
  return { success: true, message: 'Technician profile updated successfully', technician: tech };
}

export async function setStatus(actor, id, { status, activeJobId }) {
  if (!isOwnTechnician(actor, id)) throw forbidden();
  const before = await findTechnician(id);
  const tech = await prisma.technician.update({ where: { id }, data: { status, activeJobId: activeJobId || null } });
  await recordAudit(actor, { action: 'TECHNICIAN_STATUS_CHANGED', entityType: 'Technician', entityId: tech.id, diff: changedFields(before, tech, ['status', 'activeJobId']) });
  return tech;
}

export async function remove(actor, id) {
  const before = await findTechnician(id);
  await prisma.$transaction([
    prisma.user.deleteMany({ where: { technicianId: id } }),
    prisma.technician.delete({ where: { id } })
  ]);
  await recordAudit(actor, { action: 'TECHNICIAN_DELETED', entityType: 'Technician', entityId: before.id, diff: { name: before.name, phone: before.phone, status: before.status, rating: before.rating } });
  return { success: true, message: 'Technician removed successfully' };
}
