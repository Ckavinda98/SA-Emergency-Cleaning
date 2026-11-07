import { prisma } from '../db/prisma.js';
import { forbidden } from './httpError.js';

// Customers may only touch their own organization. Staff roles can see every organization.
export const canAccessOrganization = (actor, organizationId) =>
  actor.role !== 'CUSTOMER' || actor.organizationId === organizationId;

export function assertOrganizationAccess(actor, organizationId) {
  if (!canAccessOrganization(actor, organizationId)) throw forbidden();
}

// A customer is limited to their own company in list queries
export const organizationScope = (actor, field = 'organizationId') =>
  actor.role === 'CUSTOMER' ? { [field]: actor.organizationId || '__none__' } : {};

// Admin, or the technician acting on their own record
export const isOwnTechnician = (actor, techId) => actor.role === 'ADMIN' || actor.technicianId === techId;

// A technician only works on jobs assigned to them (jobs store the technician's name)
export async function isJobAssignedToTechnician(actor, job) {
  if (!actor.technicianId) return false;
  const tech = await prisma.technician.findUnique({ where: { id: actor.technicianId } });
  return Boolean(tech && technicianNameMatches(job.technicianName, tech.name));
}

// Jobs store the technician's name. Older rows add a suffix ("Dave Miller (Tech ID #104)"), so match both.
export const jobsForTechnicianName = (name) => ({
  OR: [{ technicianName: name }, { technicianName: { startsWith: `${name} (` } }]
});

export const technicianNameMatches = (jobTechName, name) => {
  if (!jobTechName || !name) return false;
  const a = jobTechName.toLowerCase(), b = name.toLowerCase();
  return a === b || a.startsWith(`${b} (`);
};

// Where-clause for jobs this actor may list: customers see their company, technicians their own jobs
export async function jobScope(actor) {
  if (actor.role === 'CUSTOMER') return organizationScope(actor);
  if (actor.role === 'TECHNICIAN') {
    const tech = actor.technicianId && await prisma.technician.findUnique({ where: { id: actor.technicianId } });
    return tech ? jobsForTechnicianName(tech.name) : { id: '__none__' };
  }
  return {};
}
