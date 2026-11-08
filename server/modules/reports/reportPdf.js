// Fills the client's Emergency Service Report template (server/assets/service-report-template.pdf)
// with the job's data. The template has no form fields, so values are drawn at the positions of its
// table cells, measured from the template (A4, 595 x 842 pt, y measured from the top of the page).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { money } from '../../../shared/membership.js';

const TEMPLATE = fileURLToPath(new URL('../../assets/service-report-template.pdf', import.meta.url));
const PAGE_H = 841.89;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.45, 0.5, 0.58);
const BRAND = rgb(0.06, 0.2, 0.42);
const WHITE = rgb(1, 1, 1);
const DETAIL_X = 192.6;
const RIGHT = 549.9;

// Standard PDF fonts only know Windows-1252 characters: swap or drop anything else
const SWAP = { '☐': '[ ]', '☑': '[x]', '✓': 'x', '→': '->', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...', '≤': '<=', '≥': '>=', '×': 'x' };
const safe = (v) => String(v ?? '').replace(/[^\x20-\x7E\xA0-\xFF–—·•€²]/g, ch => SWAP[ch] ?? (/\s/.test(ch) ? ' ' : ''));

function wrap(font, text, size, width) {
  const lines = [];
  for (const para of String(text ?? '').split(/\n/).map(safe)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else { if (line) lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

function dataUrlImage(src) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(String(src || ''));
  return m ? { type: m[1].toLowerCase() === 'png' ? 'png' : 'jpg', bytes: Buffer.from(m[2], 'base64') } : null;
}

export async function renderServiceReportPdf(r) {
  const { job, org, charges } = r;
  const pdf = await PDFDocument.load(await readFile(TEMPLATE));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [p1, p2, p3] = pdf.getPages();

  // y is the top of the text line, as read from the template
  const text = (page, x, y, value, { size = 9, f = font, color = INK } = {}) =>
    page.drawText(safe(value), { x, y: PAGE_H - y - size, size, font: f, color });
  const box = (page, x, yTop, w, h, color = WHITE) => page.drawRectangle({ x, y: PAGE_H - yTop - h, width: w, height: h, color });
  const block = (page, x, yTop, width, maxLines, value, size = 9) => {
    let lines = wrap(font, value, size, width);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')} ...`; }
    lines.forEach((l, i) => text(page, x, yTop + i * (size + 3), l, { size }));
  };
  const cell = (page, y, value, lines = 2) => block(page, DETAIL_X, y, RIGHT - DETAIL_X - 8, lines, value || 'Not recorded');
  const tick = (page, x, yTop) => {
    const b = { x: x + 1.2, y: PAGE_H - yTop - 8.6 };
    page.drawLine({ start: { x: b.x, y: b.y + 3.6 }, end: { x: b.x + 2.4, y: b.y + 1 }, thickness: 1.4, color: BRAND });
    page.drawLine({ start: { x: b.x + 2.4, y: b.y + 1 }, end: { x: b.x + 6.4, y: b.y + 7.2 }, thickness: 1.4, color: BRAND });
  };
  const when = (d) => (d ? r.fmt(d, true) : null);

  // Header: report number over the blank line
  box(p1, 329, 92, 60, 11);
  text(p1, 331, 93.6, job.reportNumber || 'DRAFT', { size: 8.5, f: bold, color: job.reportNumber ? BRAND : rgb(0.75, 0.2, 0.1) });
  if (!job.reportNumber) text(p1, 45.4, 792, `Draft for job ${job.jobNumber}: not yet issued by SACC, charges may still change.`, { size: 7.5, color: rgb(0.75, 0.2, 0.1) });

  // 1. Member & site details
  cell(p1, 202, org?.businessName || job.customerName);
  cell(p1, 231, `${org?.membershipNumber || 'No number'} / ${r.planName || ''}`);
  cell(p1, 255, `${job.locationName || ''}${job.locationName ? ', ' : ''}${job.address || ''}`);
  cell(p1, 288, job.siteRepName || job.onsiteContact);

  // 2. Incident & response times
  cell(p1, 394, job.category);
  cell(p1, 422, when(job.submittedAt || job.createdAt));
  cell(p1, 457, when(job.acknowledgedAt));
  cell(p1, 492, when(r.arrivedAt) || 'Not attended');
  cell(p1, 527, r.responseMinutes != null ? `${Math.floor(r.responseMinutes / 60)} h ${r.responseMinutes % 60} min${r.responseNote ? ` (${r.responseNote})` : ''}` : null);
  cell(p1, 563, when(job.completedAt) || 'Not completed');
  cell(p1, 591, `${job.technicianName || 'Not assigned'}${job.technicianCount > 1 ? ` + ${job.technicianCount - 1} more` : ''}`);

  // 3. Description of the incident
  const area = job.measuredArea != null ? `${job.measuredArea} m² (measured)` : job.affectedArea != null ? `${job.affectedArea} m² (reported)` : 'not recorded';
  block(p1, 45.4, 682, RIGHT - 45.4, 5, [
    job.description && `Reported: ${job.description}`,
    `Cause: ${job.causeOfIncident || 'not known'}. Surfaces: ${job.surfacesAffected || 'not recorded'}. Area: ${area}.`,
    `Water: ${r.waterLabel || 'n/a'}. Hazards: ${r.hazardLabels.join(', ') || 'none reported'}.`,
    job.reclassifyReason && `Reclassified on site: ${job.reclassifyReason}`,
    job.missedAccess && `Missed access: waited ${job.missedAccess.waitedMinutes} min, ${job.missedAccess.calls} calls, entrance photographed.`
  ].filter(Boolean).join('\n'));

  // 4. Services performed
  block(p2, 45.4, 114, RIGHT - 45.4, 4, [
    `Method: ${job.methodUsed || 'not recorded'}`,
    `Equipment: ${job.equipmentUsed || 'not recorded'}. Products: ${job.productsUsed || 'not recorded'}.`,
    `Equipment left on site: ${job.equipmentLeft || 'none'}${job.equipmentCollectionAt ? `, collection ${r.fmt(job.equipmentCollectionAt, true)}` : ''}.`
  ].join('\n'));

  // 5. Photographs: tile up to 4 per box
  const photos = async (list, x0, x1) => {
    const imgs = [];
    for (const src of list.slice(0, 4)) {
      const d = dataUrlImage(src);
      if (!d) continue;
      try { imgs.push(d.type === 'png' ? await pdf.embedPng(d.bytes) : await pdf.embedJpg(d.bytes)); } catch { /* unreadable image */ }
    }
    if (!imgs.length) return;
    const top = 251, h = 108, w = x1 - x0 - 4;
    box(p2, x0 + 2, top, w, h);
    const cols = imgs.length === 1 ? 1 : 2, rows = imgs.length > 2 ? 2 : 1;
    const cw = (w - (cols - 1) * 4) / cols, ch = (h - (rows - 1) * 4) / rows;
    imgs.forEach((img, i) => {
      const s = Math.min(cw / img.width, ch / img.height);
      const iw = img.width * s, ih = img.height * s;
      const cx = x0 + 2 + (i % cols) * (cw + 4) + (cw - iw) / 2;
      const cy = top + Math.floor(i / cols) * (ch + 4) + (ch - ih) / 2;
      p2.drawImage(img, { x: cx, y: PAGE_H - cy - ih, width: iw, height: ih });
    });
    if (list.length > 4) text(p2, x1 - 60, 352, `+${list.length - 4} more`, { size: 7, color: MUTED });
  };
  await photos(job.beforePhotos || [], 45.4, 293);
  await photos(job.afterPhotos || [], 301.4, RIGHT);

  // 6. Charges summary
  const codes = new Set(charges.lines.map(l => l.code));
  const amountFor = (cs) => charges.lines.filter(l => cs.includes(l.code)).reduce((s, l) => s + l.amount, 0);
  const otherCodes = ['EARLY_ACTIVATION', 'MISSED_ACCESS', 'LATE_CANCELLATION', 'QUOTED_WORK', 'OTHER'];
  const rows = [['INCLUDED_CALLOUT'], ['ADDITIONAL_CALLOUT'], ['LABOUR'], ['SURCHARGE'], ['DISPOSAL', 'DISPOSAL_HANDLING'], ['TRAVEL'], otherCodes];
  rows.forEach((cs, i) => {
    const y = 447.3 + i * 22.05;
    const on = cs.some(c => codes.has(c));
    tick(p2, on ? 354.1 : 381.5, y);
    const amt = on ? money(amountFor(cs)) : '–';
    text(p2, 528 - font.widthOfTextAtSize(safe(amt), 9), y + 1, amt);
  });
  const otherLabel = charges.lines.filter(l => otherCodes.includes(l.code)).map(l => l.label).join('; ');
  if (otherLabel) block(p2, 120, 581.2, 225, 1, `: ${otherLabel}`, 7.5);
  const labour = charges.lines.find(l => l.code === 'LABOUR');
  if (labour?.qty) text(p2, 260, 492.8, `(${labour.qty} h)`, { size: 7.5, color: MUTED });
  const total = money(charges.subtotal);
  text(p2, 528 - bold.widthOfTextAtSize(total, 9), 603, total, { f: bold });
  text(p2, 200, 603.5, `GST ${money(charges.gst)} · total incl. GST ${money(charges.total)}`, { size: 7.5, color: MUTED });

  // 7. Recommendations
  block(p2, 45.4, 686, RIGHT - 45.4, 4, job.recommendations || 'None.');

  // 8. Completion sign-off
  text(p3, 58, 128, 'Recorded in the SACC app', { size: 8, color: MUTED });
  const sig = dataUrlImage(job.siteRepSignature);
  if (sig) {
    try {
      const img = sig.type === 'png' ? await pdf.embedPng(sig.bytes) : await pdf.embedJpg(sig.bytes);
      const s = Math.min(200 / img.width, 32 / img.height);
      p3.drawImage(img, { x: 310, y: PAGE_H - 117 - img.height * s, width: img.width * s, height: img.height * s });
    } catch { /* unreadable signature */ }
  }
  const day = (d) => (d ? new Date(d).toLocaleDateString('en-AU', { timeZone: 'Australia/Adelaide' }) : '');
  text(p3, 81, 160.6, (job.technicianName || '').replace(/\s*\(.*\)$/, ''), { size: 8.5 });
  text(p3, 172, 160.6, day(job.completedAt), { size: 8.5 });
  text(p3, 334, 160.6, job.siteRepName || '', { size: 8.5 });
  text(p3, 424, 160.6, day(job.signedOffAt), { size: 8.5 });
  const checklist = job.checklist || {};
  const reportOnTime = r.issuedOnTime;
  [
    [51.4, 188.8, checklist.areaSafe], [317.6, 188.8, checklist.wasteLogged],
    [51.4, 206.3, checklist.photosTaken], [317.6, 206.3, checklist.equipmentReturnBooked],
    [51.4, 223.9, checklist.memberAdvised], [317.6, 223.9, reportOnTime]
  ].forEach(([x, y, on]) => { if (on) tick(p3, x, y); });

  pdf.setTitle(`Emergency Service Report ${job.reportNumber || job.jobNumber}`);
  pdf.setAuthor('SA Commercial Cleaning Services Pty Ltd');
  return Buffer.from(await pdf.save());
}
