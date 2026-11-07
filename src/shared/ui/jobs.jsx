// Job helpers shared by customer, technician and admin pages
import React from 'react';
import { Badge, cx } from './index.jsx';
import { COMPLETED_STATUSES } from '@shared/jobStatus.js';
import { TRIAGE, money } from '@shared/membership.js';

export const isCompleted = (s) => COMPLETED_STATUSES.includes(s);
export const isFinished = (s) => ['COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'CANCELLED', 'DECLINED'].includes(s);
export const isLive = (s) => ['TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(s);
export const isNewJob = (s) => s === 'NEW' || s === 'SUBMITTED';
export const hasTech = (job) => Boolean(job.technicianName && job.technicianName !== 'Unassigned');

const META = {
  NEW: { label: 'New', tone: 'brand' },
  SUBMITTED: { label: 'Submitted', tone: 'brand' },
  UNDER_REVIEW: { label: 'Acknowledged', tone: 'brand' },
  CONVERTED_TO_QUOTE: { label: 'Quote', tone: 'warning' },
  TECH_ASSIGNED: { label: 'Technician assigned', tone: 'indigo' },
  TECHNICIAN_ASSIGNED: { label: 'Technician assigned', tone: 'indigo' },
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  TRAVELLING: { label: 'On the way', tone: 'indigo' },
  ARRIVED: { label: 'Arrived on site', tone: 'rewards' },
  IN_PROGRESS: { label: 'Cleaning in progress', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  REPORT_ISSUED: { label: 'Report issued', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'slate' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  MORE_INFO_REQUIRED: { label: 'More info needed', tone: 'warning' },
  UNABLE_TO_ACCESS: { label: 'Unable to access', tone: 'danger' }
};

export const statusMeta = (s) => META[s] || { label: (s || 'NEW').replace(/_/g, ' ').toLowerCase(), tone: 'slate' };

export function StatusChip({ status, className }) {
  const m = statusMeta(status);
  return (
    <Badge tone={m.tone} className={className}>
      {isLive(status) && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {m.label}
    </Badge>
  );
}

export const jobPhotos = (job) => Array.isArray(job.photos) ? job.photos : safeJson(job.photosJson);
export const jobVideos = (job) => Array.isArray(job.videos) ? job.videos : safeJson(job.videosJson);
function safeJson(v) { try { return JSON.parse(v || '[]'); } catch { return []; } }

// The stages customers see (same stages as the service report)
export const SLA_STAGES = [
  { label: 'Submitted', done: () => true },
  { label: 'Acknowledged by SACC', done: (j) => Boolean(j.acknowledgedAt) },
  { label: 'Dispatched', done: (j) => hasTech(j) && !isNewJob(j.status) },
  { label: 'Technician accepted', done: (j) => ['ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status) },
  { label: 'On the way', done: (j) => ['TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status), current: 'TRAVELLING' },
  { label: 'Arrived', done: (j) => ['ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status), current: 'ARRIVED' },
  { label: 'Cleaning', done: (j) => ['IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status), current: 'IN_PROGRESS' },
  { label: 'Completed', done: (j) => isCompleted(j.status) }
];

// Vertical on narrow cards, horizontal when `horizontal` is set (wide screens)
export function SlaTimeline({ job, horizontal = false }) {
  return (
    <ol className={cx(horizontal ? 'grid grid-cols-8 gap-1' : 'space-y-2')}>
      {SLA_STAGES.map((s, i) => {
        const done = s.done(job);
        const current = s.current === job.status;
        return (
          <li key={s.label} className={cx(horizontal ? 'flex flex-col items-center gap-1 text-center' : 'flex items-center gap-3')}>
            <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
              current ? 'bg-brand text-white ring-4 ring-brand/20' : done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400')}>
              {i + 1}
            </span>
            <span className={cx('text-xs', done || current ? 'font-semibold text-slate-900' : 'text-slate-400')}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function MapEmbed({ address, className, interactive = false, zoom = 15 }) {
  return (
    <div className={cx('relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100', className)}>
      <iframe
        title={`Map of ${address || 'site'}`}
        className={cx('absolute inset-0 h-full w-full', !interactive && 'pointer-events-none')}
        loading="lazy"
        src={`https://maps.google.com/maps?q=${encodeURIComponent(address || 'Adelaide SA')}&z=${zoom}&output=embed`}
      />
    </div>
  );
}

export function MediaStrip({ job }) {
  const photos = jobPhotos(job);
  const videos = jobVideos(job);
  if (!photos.length && !videos.length) return <p className="text-xs text-slate-500">No photos or videos were added.</p>;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {photos.map((src, i) => (
        <a key={`p${i}`} href={src} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <img src={src} alt={`Incident photo ${i + 1}`} className="h-20 w-20 rounded-xl border border-slate-200 object-cover md:h-24 md:w-24" />
        </a>
      ))}
      {videos.map((src, i) => (
        <video key={`v${i}`} src={src} controls className="h-20 w-36 shrink-0 rounded-xl bg-black object-cover md:h-24 md:w-44" />
      ))}
    </div>
  );
}

export const formatDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

// Triage outcome from the Operations SOP (A covered, B specialist, C excluded, D grey area)
export function TriageBadge({ triage }) {
  if (!triage) return <Badge tone="slate">Not triaged</Badge>;
  const t = TRIAGE[triage];
  const tone = { COVERED: 'success', SPECIALIST: 'warning', EXCLUDED: 'danger', GREY_AREA: 'indigo' }[triage];
  return <Badge tone={tone}>{t?.label || triage}</Badge>;
}

const fmtTime = (v) => new Date(v).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', weekday: 'short', hour: 'numeric', minute: '2-digit' });

// Response target (cl. 13): 2–4 hours from SACC's acknowledgment, inside the plan's service window
export function targetText(job) {
  if (job.targetWindowFrom && job.targetAttendanceAt) return `${fmtTime(job.targetWindowFrom)} – ${fmtTime(job.targetAttendanceAt)}`;
  if (job.acknowledgedAt && !job.targetAttendanceAt) return 'Outside metro: time confirmed by phone';
  return 'Starts when SACC acknowledges the request';
}

// Charges for the visit, ex GST (Service Report Template section 6)
export function ChargesTable({ charges, className }) {
  if (!charges) return null;
  return (
    <div className={className}>
      {charges.lines.length ? (
        <table className="w-full text-sm">
          <tbody>
            {charges.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-2 text-slate-700">{l.label}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td className="pt-2 text-slate-500">Subtotal (ex GST)</td><td className="pt-2 text-right font-bold tabular-nums">{money(charges.subtotal)}</td></tr>
            <tr><td className="text-slate-500">GST</td><td className="text-right tabular-nums">{money(charges.gst)}</td></tr>
            <tr><td className="font-semibold text-slate-700">Total</td><td className="text-right font-extrabold tabular-nums">{money(charges.total)}</td></tr>
          </tfoot>
        </table>
      ) : <p className="text-sm text-slate-500">No charges so far.</p>}
    </div>
  );
}
