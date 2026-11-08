// Uploads (photos, videos, PDFs). The file goes to storage (server/lib/storage.js); the job keeps only its URL.
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { recordAudit } from '../../lib/audit.js';
import { badRequest } from '../../lib/httpError.js';
import { newPath, putFile, viewUrl } from '../../lib/storage.js';

const KINDS = ['PHOTO', 'VIDEO', 'AVATAR', 'REPORT'];

export async function upload(actor, file, body = {}) {
  if (!file) throw badRequest('Choose a JPG, PNG or WebP photo, an MP4, WebM or MOV video, or a PDF.');
  const isVideo = file.mimetype.startsWith('video/');
  if (!isVideo && file.size > env.MAX_IMAGE_MB * 1024 * 1024) {
    throw badRequest(`Photos and PDFs can be up to ${env.MAX_IMAGE_MB} MB.`);
  }
  const asked = String(body.kind || '').toUpperCase();
  const kind = KINDS.includes(asked) ? asked : (isVideo ? 'VIDEO' : 'PHOTO');

  const owner = actor.organizationId || actor.technicianId || actor.userId || 'staff';
  const path = newPath(`uploads/${owner}`, file.mimetype);
  const stored = await putFile(path, file.buffer, file.mimetype);

  // Inline mode (your PC without Supabase): the data URL goes straight into the job row
  if (stored.startsWith('data:')) return { url: stored, kind };

  const row = await prisma.fileAttachment.create({
    data: {
      kind, path, url: stored, size: file.size, mimeType: file.mimetype,
      organizationId: actor.organizationId || null,
      uploadedBy: actor.userId || null,
      jobId: await ownJobId(actor, body.jobId)
    }
  });
  await recordAudit(actor, { action: 'FILE_UPLOADED', entityType: 'FileAttachment', entityId: row.id, diff: { kind, path, size: file.size, mimeType: file.mimetype } });
  return { id: row.id, url: await viewUrl(stored), stored, kind };
}

// A customer can only tag their own company's job; staff can tag any job
async function ownJobId(actor, jobId) {
  if (!jobId) return null;
  const job = await prisma.emergencyRequest.findUnique({ where: { id: String(jobId) }, select: { id: true, organizationId: true } });
  if (!job) return null;
  if (actor.role === 'CUSTOMER' && job.organizationId !== actor.organizationId) return null;
  return job.id;
}

// Links files uploaded before the job existed to the job (called inside the job's transaction)
export async function linkFilesToJob(tx, jobId, urls = []) {
  const stored = urls.map(String).filter(u => u && !u.startsWith('data:'));
  if (!stored.length) return;
  await tx.fileAttachment.updateMany({ where: { url: { in: stored }, jobId: null }, data: { jobId } });
}
