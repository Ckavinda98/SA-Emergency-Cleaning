// Membership pieces shared by sign-up, the customer pages and the admin desk.
// Wording and numbers follow the client's Membership Agreement & Terms v1.0.
import React from 'react';
import { CheckCircle2, Phone } from 'lucide-react';
import { COMPANY, windowLabel, surchargeText, money } from '@shared/membership.js';
import { Badge, cx } from './index.jsx';

export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-AU', { timeZone: 'Australia/Adelaide', dateStyle: 'medium' }) : '–');
export const fmtMoney = money;

// The 24/7 emergency hotline (cl. 12.1), tap to call
export function HotlineLink({ className, light = false }) {
  return (
    <a href={`tel:${COMPANY.hotlineTel}`} title="Call the 24/7 emergency hotline"
      className={cx('inline-flex items-center gap-1.5 font-bold', light ? 'text-white' : 'text-brand-dark hover:underline', className)}>
      <Phone className="h-4 w-4" />{COMPANY.hotline}
    </a>
  );
}

// What each plan includes (cl. 2, 7, 8, 13.3, 14.1)
export function planFeatures(p, config) {
  return [
    `${p.callouts} included call-out${p.callouts > 1 ? 's' : ''} a month (first hour, one technician)`,
    `Extra labour ${money(p.labourRate)}/hr + GST`,
    `Service window: ${windowLabel(p)}`,
    surchargeText(p, config),
    `${p.priorityLabel || ''} dispatch`.trim(),
    `Earns ${p.price} reward points a month`
  ];
}

export function PlanCards({ plans, config, current, pending, selected, onSelect, className }) {
  return (
    <div className={cx('grid gap-3 md:grid-cols-3', className)}>
      {plans.map(p => {
        const isSel = selected === p.id;
        const Tag = onSelect ? 'button' : 'div';
        return (
          <Tag key={p.id} type={onSelect ? 'button' : undefined} onClick={onSelect ? () => onSelect(p.id) : undefined}
            className={cx('flex flex-col rounded-2xl border-2 p-4 text-left transition-colors', onSelect && 'cursor-pointer',
              isSel ? 'border-brand bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300')}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-bold text-slate-900">{p.name}</span>
              {current === p.id && <Badge tone="success">Current</Badge>}
              {pending === p.id && <Badge tone="warning">From next period</Badge>}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-brand">{money(p.price)}<span className="text-sm font-medium text-slate-500">/month + GST</span></div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              {planFeatures(p, config).map(f => <li key={f} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{f}</li>)}
            </ul>
          </Tag>
        );
      })}
    </div>
  );
}

export function LoyaltyBadge({ level }) {
  if (!level) return <Badge tone="slate">Member</Badge>;
  const tone = { Bronze: 'warning', Silver: 'slate', Gold: 'rewards' }[level] || 'slate';
  return <Badge tone={tone}>{level} member</Badge>;
}
