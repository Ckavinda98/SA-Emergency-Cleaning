// Sidebar alerts for every user type: a blinking "new" label (with a count when there is more than one)
// that stops once the item is opened, and a coloured blinking dot for anything live right now
// (technicians on the way or on site, dispatched jobs). "Seen" is remembered per user in this browser.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppData, isTechniciansJob } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { cx } from '@/shared/ui/index.jsx';
import { DISPATCHED_STATUSES, FINISHED_STATUSES } from '@shared/jobStatus.js';

const LIVE = ['TRAVELLING', 'ARRIVED', 'IN_PROGRESS'];
const AWAITING = ['TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED', 'NEW', 'SUBMITTED'];
const DAY = 86400000;
const time = (v) => (v ? new Date(v).getTime() : 0);
const changedAt = (j) => Math.max(time(j.updatedAt), time(j.submittedAt), time(j.createdAt));
const keyFor = (userId, to) => `sacc_seen:${userId}:${to}`;

function readSeen(userId, to) {
  try { const v = localStorage.getItem(keyFor(userId, to)); return v ? Number(v) : Date.now() - DAY; } catch { return Date.now() - DAY; }
}

export function useNavBadges(role) {
  const { currentUser, jobs, customers, activeCustomer, activeTechnician } = useAppData();
  const userId = currentUser?.id || 'anon';
  const [tick, setTick] = useState(0);
  const [pendingRewards, setPendingRewards] = useState([]);

  // Rewards waiting for a quote (admin only), refreshed with the jobs
  useEffect(() => {
    if (role !== 'admin') return;
    let alive = true;
    fetch(`${API_BASE}/redemptions`).then(r => (r.ok ? r.json() : [])).then(d => { if (alive && Array.isArray(d)) setPendingRewards(d.filter(r => r.status === 'PENDING_APPROVAL')); }).catch(() => {});
    return () => { alive = false; };
  }, [role, jobs]);

  const markSeen = useCallback((to) => {
    try { localStorage.setItem(keyFor(userId, to), String(Date.now())); } catch { /* private mode */ }
    setTick(t => t + 1);
  }, [userId]);

  const badges = useMemo(() => {
    const seen = (to) => readSeen(userId, to);
    const out = {};
    const add = (to, { fresh = 0, live = 0, liveTone = 'green' }) => { out[to] = { fresh, live, liveTone }; };
    if (role === 'customer') {
      const mine = jobs.filter(j => !activeCustomer || j.organizationId === activeCustomer.id);
      add('/app/requests', {
        fresh: mine.filter(j => changedAt(j) > seen('/app/requests')).length,
        live: mine.filter(j => LIVE.includes(j.status)).length
      });
    } else if (role === 'technician') {
      const mine = activeTechnician ? jobs.filter(j => isTechniciansJob(j, activeTechnician)) : [];
      add('/tech/jobs', {
        fresh: mine.filter(j => AWAITING.includes(j.status) && changedAt(j) > seen('/tech/jobs')).length,
        live: mine.filter(j => LIVE.includes(j.status) || j.status === 'ACCEPTED').length,
        liveTone: 'orange'
      });
    } else if (role === 'admin') {
      add('/admin/dispatch', {
        fresh: jobs.filter(j => time(j.submittedAt || j.createdAt) > seen('/admin/dispatch')).length,
        live: jobs.filter(j => DISPATCHED_STATUSES.includes(j.status) && !FINISHED_STATUSES.includes(j.status)).length,
        liveTone: 'red'
      });
      add('/admin/map', { live: jobs.filter(j => LIVE.includes(j.status)).length });
      add('/admin/customers', { fresh: customers.filter(c => time(c.createdAt) > seen('/admin/customers')).length });
      add('/admin/rewards', { fresh: pendingRewards.filter(r => time(r.createdAt) > seen('/admin/rewards')).length });
    } else if (role === 'config') {
      add('/settings/customers', { fresh: customers.filter(c => time(c.createdAt) > seen('/settings/customers')).length });
    }
    return out;
  }, [role, userId, jobs, customers, activeCustomer, activeTechnician, pendingRewards, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { badges, markSeen };
}

const DOT = { green: 'bg-emerald-500', orange: 'bg-amber-500', red: 'bg-red-500' };

// Pulsing coloured dot: something is live. Shows a count when there is more than one.
export function LiveDot({ count, tone = 'green', title }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1" title={title || `${count} live now`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', DOT[tone])} />
        <span className={cx('relative inline-flex h-2.5 w-2.5 rounded-full', DOT[tone])} />
      </span>
      {count > 1 && <span className={cx('text-[10px] font-extrabold', tone === 'red' ? 'text-red-600' : tone === 'orange' ? 'text-amber-600' : 'text-emerald-600')}>{count}</span>}
    </span>
  );
}

// Blinking "new" label, "3 new" when there are several
export function NewPill({ count, small }) {
  if (!count) return null;
  return (
    <span className={cx('nav-blink inline-flex items-center rounded-full bg-red-600 font-extrabold uppercase leading-none text-white shadow-sm',
      small ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px] tracking-wide')} title={`${count} new since you last looked`}>
      {count > 1 ? `${count > 99 ? '99+' : count} new` : 'new'}
    </span>
  );
}

// Everything to the right of a sidebar label
export function NavBadge({ badge }) {
  if (!badge || (!badge.fresh && !badge.live)) return null;
  return (
    <span className="ml-auto flex items-center gap-1.5">
      <LiveDot count={badge.live} tone={badge.liveTone} />
      <NewPill count={badge.fresh} />
    </span>
  );
}

// Corner marker for icon-only items (collapsed rail, phone tab bar)
export function NavCornerBadge({ badge }) {
  if (!badge || (!badge.fresh && !badge.live)) return null;
  return (
    <span className="pointer-events-none absolute -right-1 -top-1 flex items-center gap-0.5">
      {badge.fresh ? <NewPill count={badge.fresh} small /> : <LiveDot count={badge.live} tone={badge.liveTone} />}
    </span>
  );
}
