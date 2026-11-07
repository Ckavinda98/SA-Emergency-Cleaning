// Membership rules from the client's Membership Agreement & Terms v1.0. Pure functions, shared by the
// web app and the API, so the screens and the server always agree. Clause numbers refer to the Agreement.
import { DEFAULT_CONFIG, planFor } from './config.js';

export const COMPANY = {
  legalName: 'SA Commercial Cleaning Services Pty Ltd',
  shortName: 'SACC',
  acn: '664 821 694',
  abn: '42 664 821 694',
  hotline: '0498 352 839',
  hotlineTel: '+61498352839',
  publicLiability: '$20,000,000'
};

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const TZ = 'Australia/Adelaide';

// Date parts in Adelaide time, whatever time zone the server runs in
export function adelaideParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-AU', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(date)).map(p => [p.type, p.value]));
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, mi: +parts.minute, dateKey: `${parts.year}-${parts.month}-${parts.day}` };
}

export const money = (n) => `$${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
export const exGst = (n) => `${money(n)} + GST`;

// ---- Service windows and surcharges (cl. 7) ----
// After Hours is 9:00 pm to 6:00 am on any day
export const isAfterHours = (date) => { const { h } = adelaideParts(date); return h < 6 || h >= 21; };
export const isPublicHoliday = (date, config = DEFAULT_CONFIG) => (config.publicHolidays || []).includes(adelaideParts(date).dateKey);

export const windowLabel = (plan) => plan?.window ? `${fmtHour(plan.window.start)} to ${fmtHour(plan.window.end)}, 7 days` : '24/7';
const fmtHour = (h) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'am' : 'pm'}`;

export const insideServiceWindow = (plan, date) => {
  if (!plan?.window) return true;
  const { h } = adelaideParts(date);
  return h >= plan.window.start && h < plan.window.end;
};

// One $50 surcharge at most per attendance (cl. 7.1). Essential after hours is at SACC's discretion and incurs it (cl. 7.2).
export function surchargeFor(plan, date, config = DEFAULT_CONFIG) {
  const afterHours = isAfterHours(date);
  const holiday = isPublicHoliday(date, config);
  const reasons = [];
  if (afterHours && plan?.afterHoursSurcharge) reasons.push('After hours');
  if (holiday && plan?.publicHolidaySurcharge) reasons.push('Public holiday');
  return { amount: reasons.length ? (config.surchargeAmount ?? 50) : 0, reason: reasons.join(' and ') || null, afterHours, holiday };
}

export function surchargeText(plan, config = DEFAULT_CONFIG) {
  const fee = money(config.surchargeAmount ?? 50);
  if (!plan?.afterHoursSurcharge && !plan?.publicHolidaySurcharge) return 'No surcharges at any time';
  if (plan.window) return `After hours by arrangement only (+${fee}); public holidays +${fee}`;
  return `After hours and public holidays +${fee}`;
}

// ---- Response clock (cl. 13) ----
// The clock runs from SACC's acknowledgment. Essential: acknowledged outside the window counts as 6:00 am.
export function responseClockStart(plan, acknowledgedAt) {
  const at = new Date(acknowledgedAt);
  if (insideServiceWindow(plan, at)) return at;
  const { h, mi } = adelaideParts(at);
  const start = plan.window.start;
  const hoursUntil = h >= plan.window.end ? (24 - h + start) : (start - h);
  return new Date(at.getTime() + hoursUntil * HOUR - mi * 60000 - at.getSeconds() * 1000 - at.getMilliseconds());
}

export function responseTarget(plan, acknowledgedAt, config = DEFAULT_CONFIG) {
  const start = responseClockStart(plan, acknowledgedAt);
  const { min = 2, max = 4 } = config.responseTargetHours || {};
  return { clockStart: start, from: new Date(start.getTime() + min * HOUR), to: new Date(start.getTime() + max * HOUR) };
}

// ---- Waiting period (cl. 3) ----
export const membershipDay = (activationDate, at = new Date()) =>
  Math.floor((new Date(at) - new Date(activationDate)) / DAY) + 1;
export const inWaitingPeriod = (activationDate, at = new Date(), config = DEFAULT_CONFIG) =>
  Boolean(activationDate) && membershipDay(activationDate, at) <= (config.waitingPeriodDays ?? 10);

// ---- Labour (cl. 8.2, 8.3) ----
// The included hour covers one technician for one hour; technician time is combined.
// Time beyond it is shared across the technicians and each technician's share is billed in whole hours.
export function billableLabourHours(minutesOnSite, technicians = 1, includedHours = 1) {
  const techs = Math.max(1, Number(technicians) || 1);
  const extra = Math.max(0, (Number(minutesOnSite) || 0) * techs - includedHours * 60);
  if (!extra) return 0;
  return techs * Math.ceil(extra / techs / 60);
}

// ---- Charges for one attendance (cl. 3.2, 7, 8, 12.4, 12.5, 18.2) ----
// rates: the member's locked rates (cl. 15.2), falling back to the plan
export function jobCharges(job, plan, config = DEFAULT_CONFIG, rates = {}) {
  const r = { labourRate: plan?.labourRate ?? 0, additionalCalloutFee: config.additionalCalloutFee ?? 30, ...rates };
  const lines = [];
  const add = (code, label, qty, unit) => { const amount = Math.round(qty * unit * 100) / 100; if (amount || code === 'INCLUDED_CALLOUT') lines.push({ code, label, qty, unit, amount }); };

  const quoted = job.triage === 'SPECIALIST' || job.quoteStatus === 'ACCEPTED' || job.quoteStatus === 'DECLINED';
  if (job.calloutType === 'INCLUDED') add('INCLUDED_CALLOUT', 'Included call-out (attendance + first hour)', 1, 0);
  if (job.calloutType === 'ADDITIONAL') add('ADDITIONAL_CALLOUT', 'Additional call-out', 1, r.additionalCalloutFee);
  if (job.earlyActivation) add('EARLY_ACTIVATION', 'Early activation fee (first 10 days)', 1, config.earlyActivationFee ?? 100);
  if (!quoted && !job.missedAccessAt && !job.cancelledAt) {
    const hours = billableLabourHours(job.timerMinutes, job.technicianCount, plan?.hoursPerCallout ?? 1);
    if (hours) add('LABOUR', `Labour beyond the included hour (${hours} h × ${money(r.labourRate)})`, hours, r.labourRate);
  }
  if (job.surchargeAmount) add('SURCHARGE', `Surcharge: ${job.surchargeReason || 'after hours / public holiday'}`, 1, job.surchargeAmount);
  const disposal = parseList(job.disposalJson ?? job.disposal);
  if (disposal.length) {
    const cost = disposal.reduce((s, d) => s + (Number(d.cost) || 0), 0);
    add('DISPOSAL', `Special disposal at cost (${disposal.map(d => d.item).join(', ')})`, 1, cost);
    add('DISPOSAL_HANDLING', 'Disposal handling fee', 1, config.disposalHandlingFee ?? 25);
  }
  if (job.travelKm) add('TRAVEL', `Travel ${job.travelKm} km each way × ${money(config.travelRatePerKm ?? 1.5)}/km`, job.travelKm * 2, config.travelRatePerKm ?? 1.5);
  if (job.missedAccessAt) add('MISSED_ACCESS', 'Missed access attendance fee', 1, config.missedAccessFee ?? 100);
  if (job.cancellationFee) add('LATE_CANCELLATION', 'Cancelled after dispatch', 1, job.cancellationFee);
  if (job.quoteStatus === 'ACCEPTED' && job.quoteAmount) add('QUOTED_WORK', 'Specialist work (accepted quote)', 1, job.quoteAmount);
  if (job.otherCharges) add('OTHER', job.otherChargesNote || 'Other', 1, job.otherCharges);

  const subtotal = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const gst = Math.round(subtotal * (config.gstRate ?? 0.1) * 100) / 100;
  return { lines, subtotal, gst, total: Math.round((subtotal + gst) * 100) / 100 };
}

export const parseList = (v) => { if (Array.isArray(v)) return v; try { return JSON.parse(v || '[]'); } catch { return []; } };

// ---- Coverage (cl. 9, 10) ----
// Returns the reasons a request is outside the covered boundaries (empty when it looks covered)
export function coverageWarnings({ category, affectedArea, waterType, hazards = [] }, config = DEFAULT_CONFIG) {
  const out = [];
  const limits = config.coverageLimits || {};
  const area = Number(affectedArea) || 0;
  if (waterType === 'GREY' || waterType === 'BLACK') out.push('Grey or black water (sewage) is a specialist service and is quoted separately.');
  if ((config.waterCategories || []).includes(category) && area > (limits.cleanWaterM2 ?? 10)) out.push(`Water incidents over about ${limits.cleanWaterM2 ?? 10} m² are quoted separately.`);
  if ((config.graffitiCategories || []).includes(category) && area > (limits.graffitiM2 ?? 2)) out.push(`Graffiti over ${limits.graffitiM2 ?? 2} m² is quoted separately.`);
  if (hazards.includes('SHARPS')) out.push('Sharps removal is a specialist service.');
  if (hazards.includes('CHEMICALS')) out.push('Hazardous chemical spills are a specialist service.');
  if (hazards.includes('STRUCTURAL') || hazards.includes('ELECTRICITY')) out.push('The site may not be safe: SACC will assess before attending.');
  return out;
}

export const HAZARDS = [
  { id: 'ELECTRICITY', label: 'Electricity near water' },
  { id: 'SHARPS', label: 'Sharps (needles)' },
  { id: 'CHEMICALS', label: 'Chemicals' },
  { id: 'STRUCTURAL', label: 'Structural damage' }
];
export const WATER_TYPES = [
  { id: 'NONE', label: 'No water involved' },
  { id: 'CLEAN', label: 'Clean water (tap, burst pipe, rain)' },
  { id: 'GREY', label: 'Grey water (sinks, washing machines)' },
  { id: 'BLACK', label: 'Black water (sewage, toilet waste)' }
];

// Triage outcomes from the Operations SOP
export const TRIAGE = {
  COVERED: { code: 'A', label: 'A · Covered', hint: 'Dispatch under the membership.' },
  SPECIALIST: { code: 'B', label: 'B · Specialist', hint: 'Quote separately. No call-out is used.' },
  EXCLUDED: { code: 'C', label: 'C · Excluded', hint: 'Not a service SACC provides. Decline and explain.' },
  GREY_AREA: { code: 'D', label: 'D · Grey area', hint: 'Manager decides within 15 minutes.' }
};

// ---- Membership length, loyalty, rewards (cl. 14, 15) ----
export function monthsBetween(from, to = new Date()) {
  const a = new Date(from), b = new Date(to);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

export function loyaltyLevel(activationDate, at = new Date(), config = DEFAULT_CONFIG) {
  if (!activationDate) return null;
  const months = monthsBetween(activationDate, at);
  return [...(config.loyaltyLevels || [])].sort((a, b) => b.months - a.months).find(l => months >= l.months) || null;
}

export const daysUntilMonthlyReset = (at = new Date()) => {
  const { y, m, d } = adelaideParts(at);
  const daysInMonth = new Date(y, m, 0).getDate();
  return daysInMonth - d + 1;
};

// ---- Fees (cl. 2, 6, 17) ----
export function multiSiteDiscount(siteCount, config = DEFAULT_CONFIG) {
  if (siteCount >= 11) return { percent: (config.multiSiteDiscounts || []).reduce((m, d) => Math.max(m, d.percent), 0), custom: true };
  const tier = (config.multiSiteDiscounts || []).find(d => siteCount >= d.min && siteCount <= d.max);
  return { percent: tier ? tier.percent : 0, custom: false };
}

// Monthly membership fee for a set of site plans, after the multi-site discount
export function membershipFee(sitePlanIds, config = DEFAULT_CONFIG) {
  const gross = sitePlanIds.reduce((s, id) => s + (planFor(config, id)?.price || 0), 0);
  const discount = multiSiteDiscount(sitePlanIds.length, config);
  const monthly = Math.round(gross * (100 - discount.percent)) / 100;
  return { gross, discountPercent: discount.percent, customPricing: discount.custom, monthly, annual: Math.round(monthly * 12 * 100) / 100 };
}

// Pro-rata amount for the rest of a billing period (cl. 5.3, 6.2)
export function proRata(amountPerPeriod, periodStart, periodEnd, from = new Date()) {
  const total = new Date(periodEnd) - new Date(periodStart);
  const left = Math.max(0, new Date(periodEnd) - new Date(from));
  return total > 0 ? Math.round(amountPerPeriod * (left / total) * 100) / 100 : 0;
}

// Current billing period from the activation date (monthly: same day each month; annual: each anniversary)
export function billingPeriod(activationDate, frequency = 'MONTHLY', at = new Date()) {
  const step = frequency === 'ANNUAL' ? 12 : 1;
  const a = new Date(activationDate);
  let n = Math.floor(monthsBetween(a, at) / step) * step;
  const start = addMonths(a, n);
  return { start, end: addMonths(a, n + step) };
}

export function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

// ---- Service area (cl. 18) ----
export function postcodeOf(address) {
  const m = String(address || '').match(/\b(5\d{3})\b(?!.*\b5\d{3}\b)/);
  return m ? Number(m[1]) : null;
}

// METRO, OUTSIDE_METRO (SA, accepted at SACC's discretion with travel) or OUTSIDE_SA
export function serviceArea(address, config = DEFAULT_CONFIG) {
  const text = String(address || '');
  const pc = postcodeOf(text);
  if (pc) {
    const metro = (config.metroPostcodes?.ranges || []).some(([a, b]) => pc >= a && pc <= b);
    return metro ? 'METRO' : 'OUTSIDE_METRO';
  }
  if (/\b(NSW|VIC|QLD|WA|TAS|NT|ACT)\b|\b[0-46-9]\d{3}\b/i.test(text)) return 'OUTSIDE_SA';
  // No postcode: an Adelaide address without a postcode is treated as metro, anything else needs a check
  return /adelaide|\bSA\b|south australia/i.test(text) ? 'METRO' : 'OUTSIDE_SA';
}

// Completion sign-off checklist (Service Report Template section 8)
export const REPORT_CHECKLIST = [
  { id: 'areaSafe', label: 'Area left safe and operational' },
  { id: 'wasteLogged', label: 'Special waste bagged and logged' },
  { id: 'photosTaken', label: 'Before and after photos captured' },
  { id: 'equipmentReturnBooked', label: 'Equipment return booked (if applicable)' },
  { id: 'memberAdvised', label: 'Member advised of any recommended works' }
];

// What a technician must record before a step (Operations SOP, Service Report Template).
// Works on API jobs (arrays) and database rows (JSON text).
export function onSiteMissing(job, nextStatus) {
  const before = parseList(job.beforePhotos ?? job.beforePhotosJson);
  const after = parseList(job.afterPhotos ?? job.afterPhotosJson);
  if (nextStatus === 'IN_PROGRESS' && !before.length) return 'Take at least one before photo before starting work.';
  if (nextStatus === 'IN_PROGRESS' && job.measuredArea == null) return 'Measure the affected area (m²) before starting work.';
  if (nextStatus === 'COMPLETED') {
    if (!after.length) return 'Take at least one after photo before completing the job.';
    if (!job.siteRepName || !job.signedOffAt) return 'Get the site representative to sign off before completing the job.';
  }
  return null;
}
