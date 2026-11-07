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
  if (!tech || !job.technicianName) return false;
  // Older jobs store the name with a suffix, e.g. "Dave Miller (Tech ID #104)".
  const assigned = job.technicianName.toLowerCase(), name = tech.name.toLowerCase();
  return assigned === name || assigned.startsWith(`${name} (`);
}
