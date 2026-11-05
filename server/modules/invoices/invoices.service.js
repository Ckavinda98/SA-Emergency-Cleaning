import { prisma } from '../../db/prisma.js';
import { notFound } from '../../lib/httpError.js';
import { recordAudit } from '../../lib/audit.js';
import { assertOrganizationAccess } from '../../lib/access.js';

export async function list(actor, organizationId) {
  assertOrganizationAccess(actor, organizationId);
  return prisma.invoice.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}

export async function create(actor, organizationId, body) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw notFound('Customer not found');
  const count = await prisma.invoice.count();
  const invoiceNumber = `INV-${new Date().getFullYear()}-${1000 + count + 1}`;
  const status = body.status || 'PAID';

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      organizationId,
      description: body.description || 'Emergency Cleaning Overage Charge',
      amount: parseFloat(body.amount || 120),
      status,
      paymentMethod: body.paymentMethod || org.paymentMethod,
      dueDate: body.dueDate ? new Date(body.dueDate) : new Date(),
      paidAt: status === 'PAID' ? new Date() : null
    }
  });

  await recordAudit(actor, {
    action: 'INVOICE_CREATED',
    entityType: 'Invoice',
    entityId: invoice.id,
    diff: { invoiceNumber, organizationId: org.id, amount: invoice.amount, status }
  });
  return invoice;
}
