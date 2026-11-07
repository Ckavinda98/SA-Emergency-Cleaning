// HTML for the printable Emergency Service Report, laid out like the client's Service Report Template
// (sections 1 to 8). Every value shown comes from the database.
import { COMPANY, REPORT_CHECKLIST, money } from '../../../shared/membership.js';

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const row = (label, value) => `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`;
const text = (v, empty = 'Not recorded') => (v ? escapeHtml(v) : `<span class="muted">${empty}</span>`);
const photoGrid = (list, empty) => list.length
  ? `<div class="photos">${list.map(src => `<img src="${escapeHtml(src)}" alt="" />`).join('')}</div>`
  : `<p class="muted">${empty}</p>`;

export function renderServiceReport(r) {
  const { job, org, download } = r;
  const charges = r.charges;
  const tick = (on) => (on ? '☑' : '☐');
  const codes = new Set(charges.lines.map(l => l.code));
  const amountFor = (...c) => charges.lines.filter(l => c.includes(l.code)).reduce((s, l) => s + l.amount, 0);
  const chargeRow = (label, cs) => `<tr><td>${escapeHtml(label)}</td><td class="c">${tick(cs.some(c => codes.has(c)))} ${cs.some(c => codes.has(c)) ? 'Yes' : 'No'}</td><td class="r">${cs.some(c => codes.has(c)) ? money(amountFor(...cs)) : '–'}</td></tr>`;
  const otherCodes = ['EARLY_ACTIVATION', 'MISSED_ACCESS', 'LATE_CANCELLATION', 'QUOTED_WORK', 'OTHER'];
  const otherLabel = charges.lines.filter(l => otherCodes.includes(l.code)).map(l => l.label).join('; ');
  const checklist = job.checklist || {};

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Emergency Service Report ${escapeHtml(job.reportNumber || job.jobNumber)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    @media print { .no-print { display: none !important; } body { background: #fff !important; margin: 0 !important; } .sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; } }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 24px; color: #1e293b; background: #f1f5f9; font-size: 12.5px; line-height: 1.45; }
    .sheet { max-width: 860px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; }
    .top { display: flex; justify-content: space-between; gap: 16px; border-bottom: 3px solid #0f766e; padding-bottom: 14px; }
    .brand { font-size: 18px; font-weight: 800; color: #0f766e; }
    .meta { text-align: right; font-size: 12px; }
    .meta b { font-size: 14px; }
    h2 { font-size: 13px; margin: 22px 0 8px; color: #0f766e; text-transform: uppercase; letter-spacing: .4px; break-after: avoid; }
    table { border-collapse: collapse; width: 100%; }
    .kv th { width: 34%; text-align: left; font-weight: 600; color: #475569; background: #f8fafc; }
    .kv th, .kv td, .ch td, .ch th { border: 1px solid #e2e8f0; padding: 6px 9px; vertical-align: top; }
    .ch th { background: #f8fafc; text-align: left; }
    .c { text-align: center; white-space: nowrap; } .r { text-align: right; white-space: nowrap; }
    .total td { font-weight: 700; background: #f0fdfa; }
    .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; white-space: pre-wrap; min-height: 34px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .photos { display: flex; flex-wrap: wrap; gap: 8px; }
    .photos img { width: 120px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; }
    .muted { color: #94a3b8; }
    .sig img { max-height: 70px; max-width: 220px; display: block; margin-top: 4px; }
    .checks { columns: 2; margin-top: 10px; }
    .note { margin-top: 16px; padding: 10px 12px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; }
    .foot { margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; color: #64748b; font-size: 11px; }
    .bar { max-width: 860px; margin: 0 auto 14px; display: flex; justify-content: space-between; align-items: center; background: #0f766e; color: #fff; padding: 10px 16px; border-radius: 10px; }
    .bar button { background: #fff; color: #0f766e; border: 0; padding: 7px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 8px 12px; border-radius: 8px; margin-top: 12px; }
  </style>
  ${download ? '<script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>' : ''}
</head>
<body>
  <div class="bar no-print"><span>Emergency Service Report · ${escapeHtml(job.jobNumber)}</span><button onclick="window.print()">Save as PDF / Print</button></div>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="brand">${escapeHtml(COMPANY.legalName)}</div>
        <div>Emergency Service Report · 24/7 hotline ${escapeHtml(COMPANY.hotline)}</div>
      </div>
      <div class="meta">
        <b>Report No: ${job.reportNumber ? escapeHtml(job.reportNumber) : '<span class="muted">Not issued yet</span>'}</b><br />
        Job ${escapeHtml(job.jobNumber)}<br />
        ${job.reportIssuedAt ? `Issued ${escapeHtml(r.fmt(job.reportIssuedAt, true))}` : 'Issued within 24 hours of attendance'}
      </div>
    </div>
    ${!job.reportIssuedAt ? '<div class="warn no-print">Draft: this report has not been issued yet. Charges may still change.</div>' : ''}

    <h2>1. Member &amp; site details</h2>
    <table class="kv">
      ${row('Member business name', text(org?.businessName || job.customerName))}
      ${row('Membership number / plan', `${text(org?.membershipNumber, 'No number')} / ${escapeHtml(r.planName || '')}`)}
      ${row('Site address', `${escapeHtml(job.locationName)}<br/>${escapeHtml(job.address)}`)}
      ${row('Site representative on the day', text(job.siteRepName || job.onsiteContact))}
    </table>

    <h2>2. Incident &amp; response times</h2>
    <table class="kv">
      ${row('Incident type', text(job.category))}
      ${row('Request received (date / time)', escapeHtml(r.fmt(job.submittedAt, true)))}
      ${row('Request acknowledged (date / time)', job.acknowledgedAt ? escapeHtml(r.fmt(job.acknowledgedAt, true)) : text(null))}
      ${row('Technician arrival (date / time)', r.arrivedAt ? escapeHtml(r.fmt(r.arrivedAt, true)) : text(null, 'Not attended'))}
      ${row('Response time (acknowledgment to arrival)', r.responseMinutes != null ? `${Math.floor(r.responseMinutes / 60)} h ${r.responseMinutes % 60} min${r.responseNote ? ` <span class="muted">(${escapeHtml(r.responseNote)})</span>` : ''}` : text(null))}
      ${row('Work completed (date / time)', job.completedAt ? escapeHtml(r.fmt(job.completedAt, true)) : text(null, 'Not completed'))}
      ${row('Technician(s) attending', `${text(job.technicianName, 'Not assigned')}${job.technicianCount > 1 ? ` + ${job.technicianCount - 1} more (${job.technicianCount} technicians)` : ''}`)}
    </table>

    <h2>3. Description of the incident</h2>
    <table class="kv">
      ${row('Reported by member', text(job.description))}
      ${row('Cause (if known)', text(job.causeOfIncident))}
      ${row('Surfaces affected', text(job.surfacesAffected))}
      ${row('Approximate area', job.measuredArea != null ? `${escapeHtml(job.measuredArea)} m² (measured on site)` : job.affectedArea != null ? `${escapeHtml(job.affectedArea)} m² (reported)` : text(null))}
      ${row('Water type', text(r.waterLabel))}
      ${row('Hazards present', text(r.hazardLabels.join(', '), 'None reported'))}
      ${job.reclassifyReason ? row('Reclassified on site', `${escapeHtml(job.reclassifyReason)}${job.quoteStatus ? ` · quote ${escapeHtml(job.quoteStatus.toLowerCase())}` : ''}`) : ''}
      ${job.missedAccess ? row('Missed access', `Waited ${escapeHtml(job.missedAccess.waitedMinutes)} min, ${escapeHtml(job.missedAccess.calls)} calls made, entrance photographed`) : ''}
    </table>

    <h2>4. Services performed</h2>
    <table class="kv">
      ${row('Method', text(job.methodUsed))}
      ${row('Equipment used', text(job.equipmentUsed))}
      ${row('Products used', text(job.productsUsed))}
      ${row('Equipment left on site', text(job.equipmentLeft, 'None'))}
      ${row('Equipment collection date', job.equipmentCollectionAt ? escapeHtml(r.fmt(job.equipmentCollectionAt, true)) : text(null, '–'))}
    </table>

    <h2>5. Photographs</h2>
    <div class="cols">
      <div><b>Before</b>${photoGrid(job.beforePhotos, 'No before photos')}</div>
      <div><b>After</b>${photoGrid(job.afterPhotos, 'No after photos')}</div>
    </div>
    ${job.photos.length ? `<p style="margin-top:10px"><b>Sent by the member</b></p>${photoGrid(job.photos, '')}` : ''}
    ${job.missedAccess?.entrancePhoto ? `<p style="margin-top:10px"><b>Site entrance (missed access)</b></p>${photoGrid([job.missedAccess.entrancePhoto], '')}` : ''}

    <h2>6. Charges summary</h2>
    <table class="ch">
      <tr><th>Item</th><th class="c">Applies</th><th class="r">Amount (ex GST)</th></tr>
      <tr><td>Included call-out consumed</td><td class="c">${tick(codes.has('INCLUDED_CALLOUT'))} ${codes.has('INCLUDED_CALLOUT') ? 'Yes' : 'No'}</td><td class="r">${codes.has('INCLUDED_CALLOUT') ? '$0' : '–'}</td></tr>
      ${chargeRow(`Additional call-out fee (${money(r.rates.additionalCalloutFee)})`, ['ADDITIONAL_CALLOUT'])}
      ${chargeRow(`Labour beyond included hour (hrs × ${money(r.rates.labourRate)}/hr)`, ['LABOUR'])}
      ${chargeRow(`After-hours / public holiday surcharge (${money(r.config.surchargeAmount)})`, ['SURCHARGE'])}
      ${chargeRow(`Special disposal (at cost + ${money(r.config.disposalHandlingFee)} handling)`, ['DISPOSAL', 'DISPOSAL_HANDLING'])}
      ${chargeRow(`Travel outside Adelaide metro (${money(r.config.travelRatePerKm)}/km each way)`, ['TRAVEL'])}
      <tr><td>Other${otherLabel ? `: ${escapeHtml(otherLabel)}` : ' (specify)'}</td><td class="c">${tick(Boolean(otherLabel))} ${otherLabel ? 'Yes' : 'No'}</td><td class="r">${otherLabel ? money(amountFor(...otherCodes)) : '–'}</td></tr>
      <tr class="total"><td>Total invoiced (ex GST)</td><td></td><td class="r">${money(charges.subtotal)}</td></tr>
      <tr><td>GST</td><td></td><td class="r">${money(charges.gst)}</td></tr>
      <tr><td>Total including GST</td><td></td><td class="r">${money(charges.total)}</td></tr>
    </table>
    ${charges.lines.length ? `<p class="muted" style="margin-top:6px">${charges.lines.map(l => escapeHtml(`${l.label}: ${money(l.amount)}`)).join(' · ')}</p>` : ''}

    <h2>7. Recommendations</h2>
    <div class="box">${text(job.recommendations, 'None')}</div>

    <h2>8. Completion sign-off</h2>
    <div class="cols">
      <div class="box sig"><b>Technician</b><br />Name: ${text(job.technicianName)}<br />Date: ${job.completedAt ? escapeHtml(r.fmt(job.completedAt, true)) : '–'}</div>
      <div class="box sig"><b>Site representative</b><br />Name: ${text(job.siteRepName)}<br />Date: ${job.signedOffAt ? escapeHtml(r.fmt(job.signedOffAt, true)) : '–'}
        ${job.siteRepSignature ? `<img src="${escapeHtml(job.siteRepSignature)}" alt="Signature" />` : ''}</div>
    </div>
    <div class="checks">
      ${REPORT_CHECKLIST.map(c => `<div>${tick(checklist[c.id])} ${escapeHtml(c.label)}</div>`).join('')}
      <div>${tick(Boolean(job.reportIssuedAt && r.issuedOnTime))} Report sent to member within 24 hours</div>
    </div>

    <div class="note"><b>Workmanship guarantee.</b> If you are not satisfied with this clean, contact us within 24 hours on ${escapeHtml(COMPANY.hotline)} and we will re-attend and rectify at no cost.
      This report may be provided to your insurer for your own purposes; ${escapeHtml(COMPANY.legalName)} does not prepare formal insurance reports or deal with insurers directly.</div>

    <div class="foot">${escapeHtml(COMPANY.legalName)} · ACN ${COMPANY.acn} · ABN ${COMPANY.abn} · Public liability insurance ${COMPANY.publicLiability}</div>
  </div>
</body>
</html>`;
}
