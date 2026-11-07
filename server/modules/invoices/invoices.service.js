import { prisma } from '../../db/prisma.js';
import { notFound } from '../../lib/httpError.js';
import { recordAudit } from '../../lib/audit.js';
import { assertOrganizationAccess } from '../../lib/access.js';
import { badRequest } from '../../lib/httpError.js';
import { getConfig } from '../config/config.service.js';

export async function list(actor, organizationId) {
  assertOrganizationAccess(actor, organizationId);
  return prisma.invoice.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}

export async function create(actor, organizationId, body) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw notFound('Customer not found');
  const count = await prisma.invoice.count();
  const invoiceNumber = `INV-${new Date().getFullYear()}-${1000 + count + 1}`;
  const status = body.status || 'PENDING';
  const amount = parseFloat(body.amount);
  if (!Number.isFinite(amount) || amount === 0) throw badRequest('Enter the invoice amount (ex GST).');
  const config = await getConfig();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      organizationId,
      description: body.description || 'Emergency attendance extras',
      kind: body.kind || 'EXTRAS',
      amount,
      gst: Math.round(amount * (config.gstRate ?? 0.1) * 100) / 100,
      status,
      paymentMethod: body.paymentMethod || org.paymentMethod,
      // Extras are payable within 7 days (cl. 4.3)
      dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + (config.extrasPaymentTermsDays ?? 7) * 86400000),
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
