// W22 Settings (was Config Studio): pricing, plans, service rules and reward rules, each with its own URL.
// Defaults come from the Membership Agreement v1.0 (clause numbers in the hints); all amounts are ex GST.
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { DollarSign, ShieldCheck, FileText, Gift, Save, RotateCcw, CalendarDays, MapPin, Clock } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Button, Field, Badge, StickyActions, inputCls, useToast, useFieldErrors, cx } from '@/shared/ui/index.jsx';
import { numberError } from '@shared/validation.js';
import { CONFIG_VERSION } from '@shared/config.js';
import { windowLabel } from '@shared/membership.js';

const SECTIONS = [
  { key: 'pricing', label: 'Pricing', icon: DollarSign },
  { key: 'plans', label: 'Plans', icon: ShieldCheck },
  { key: 'rules', label: 'Service rules', icon: FileText },
  { key: 'rewards', label: 'Reward points', icon: Gift }
];

// Top-level number settings: [key, label, hint, section, min]
const NUMBERS = [
  ['additionalCalloutFee', 'Additional call-out fee ($)', 'cl. 8.1: after the included call-outs', 'pricing', 0],
  ['surchargeAmount', 'After-hours / public holiday surcharge ($)', 'cl. 7: once per attendance', 'pricing', 0],
  ['earlyActivationFee', 'Early activation fee ($)', 'cl. 3.2: call-out inside the waiting period', 'pricing', 0],
  ['missedAccessFee', 'Missed access fee ($)', 'cl. 12.4', 'pricing', 0],
  ['lateCancellationFee', 'Late cancellation fee ($)', 'cl. 12.5: after a technician is dispatched', 'pricing', 0],
  ['disposalHandlingFee', 'Disposal handling fee ($)', 'cl. 8.4: plus cost', 'pricing', 0],
  ['travelRatePerKm', 'Travel outside metro ($/km)', 'cl. 18.2: each way from the GPO', 'pricing', 0],
  ['waitingPeriodDays', 'Waiting period (days)', 'cl. 3.1', 'rules', 0],
  ['termMonths', 'Minimum term (months)', 'cl. 5.1', 'rules', 0],
  ['cancelAfterCalloutDays', 'No cancelling within (days of a call-out)', 'cl. 5.2', 'rules', 0],
  ['suspendAfterDays', 'Suspend after failed payment (days)', 'cl. 4.4', 'rules', 0],
  ['cancellationReviewAfterDays', 'Review for cancellation after (days)', 'cl. 5.4', 'rules', 0],
  ['extrasPaymentTermsDays', 'Extras invoice terms (days)', 'cl. 4.3', 'rules', 0],
  ['greyAreaDecisionMinutes', 'Grey-area decision within (minutes)', 'SOP triage D', 'rules', 0],
  ['missedAccessWaitMinutes', 'Missed access wait (minutes)', 'SOP', 'rules', 0],
  ['missedAccessCalls', 'Missed access calls', 'SOP', 'rules', 0],
  ['reportDueHours', 'Service report due (hours)', 'cl. 16', 'rules', 0],
  ['workmanshipNoticeHours', 'Workmanship notice (hours)', 'cl. 20', 'rules', 0],
  ['tenureMinMonths', 'Months before points can be used', 'cl. 14.4', 'rewards', 0],
  ['pointsExpiryMonths', 'Points expire after (months)', 'cl. 14.5', 'rewards', 1],
  ['unusedCalloutPoints', 'Points per unused call-out', 'cl. 14.3', 'rewards', 0],
  ['referralPoints', 'Points per referral', 'cl. 14.7', 'rewards', 0],
  ['goodwillPoints', 'Late arrival credit (points)', 'cl. 13.5', 'rewards', 0]
];
const PLAN_NUMBERS = [['price', 'Price ($/month)', 0], ['labourRate', 'Labour after 1st hour ($/hr)', 0], ['callouts', 'Call-outs per month', 0], ['hoursPerCallout', 'Hours per call-out', 1], ['priority', 'Priority (1 = first)', 1]];

const lines = (v) => v.split('\n').map(x => x.trim()).filter(Boolean);
const rangesText = (r) => (r || []).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join('\n');
const parseRanges = (t) => lines(t).map(l => l.split('-').map(n => parseInt(n, 10))).filter(p => p.every(Number.isFinite)).map(p => [p[0], p[1] ?? p[0]]);

export function SettingsPage() {
  const { section } = useParams();
  const { config, setConfig } = useAppData();
  const { notify } = useToast();
  const [draft, setDraftState] = useState(() => structuredClone(config));
  const touched = useRef(false);
  const setDraft = (next) => { touched.current = true; setDraftState(next); };
  const resetDraft = (from) => { touched.current = false; setDraftState(structuredClone(from)); };
  // Settings load from the server after the page opens; follow them until the user starts editing.
  useEffect(() => { if (!touched.current) setDraftState(structuredClone(config)); }, [config]);
  const [saving, setSaving] = useState(false);
  const { errors, check } = useFieldErrors();
  const current = SECTIONS.find(s => s.key === section);
  if (!current) return <Navigate to="/settings/pricing" replace />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);
  const setPlan = (id, key, value) => setDraft(d => ({ ...d, membershipPlans: d.membershipPlans.map(p => (p.id === id ? { ...p, [key]: value } : p)) }));
  const setKey = (key, value) => setDraft(d => ({ ...d, [key]: value }));
  const num = (v) => (v === '' ? '' : Number(v));

  const validate = () => {
    const rules = { incidentCategories: d => ((d.incidentCategories || []).length ? '' : 'Add at least one incident type.') };
    NUMBERS.forEach(([k, label, , , min]) => { rules[k] = d => numberError(d[k], { label, min }); });
    (draft.membershipPlans || []).forEach(p => PLAN_NUMBERS.forEach(([k, label, min]) => { rules[`${k}-${p.id}`] = () => numberError(p[k] ?? min, { label, min }); }));
    return check(rules, draft);
  };

  const save = async () => {
    if (!validate()) { notify('Some values need fixing. They are marked in red.', 'danger'); return; }
    const clean = { ...draft, configVersion: CONFIG_VERSION };
    NUMBERS.forEach(([k]) => { clean[k] = Number(draft[k]) || 0; });
    clean.membershipPlans = draft.membershipPlans.map(p => ({ ...p, ...Object.fromEntries(PLAN_NUMBERS.map(([k, , min]) => [k, Number(p[k]) || min])) }));
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) notify(data.error || 'The settings were not saved.', 'danger');
      else { const saved = data.config || clean; setConfig(saved); resetDraft(saved); notify('Settings saved. Customers see the new values straight away.'); }
    } catch { notify('Cannot reach the server. The settings were not saved.', 'danger'); }
    setSaving(false);
  };

  const numberFields = (sec) => NUMBERS.filter(n => n[3] === sec).map(([k, label, hint, , min]) => (
    <Field key={k} label={label} hint={hint} error={errors[k]}><input type="number" min={min} step="any" className={inputCls} value={draft[k] ?? ''} onChange={e => setKey(k, num(e.target.value))} /></Field>
  ));

  return (
    <Page title="Settings" subtitle="Prices and business rules from the Membership Agreement, used across the app" breadcrumb={[{ label: 'Settings' }, { label: current.label }]}>
      <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 xl:flex-col xl:self-start xl:rounded-2xl xl:border xl:border-slate-200 xl:bg-white xl:p-2" aria-label="Settings sections">
          {SECTIONS.map(s => (
            <NavLink key={s.key} to={`/settings/${s.key}`} className={({ isActive }) => cx('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold',
              isActive ? 'bg-white text-brand-dark shadow-sm xl:bg-sky-50 xl:shadow-none xl:ring-1 xl:ring-sky-200' : 'text-slate-600 hover:text-slate-900 xl:hover:bg-slate-50')}>
              <s.icon className="h-4 w-4" />{s.label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {section === 'pricing' && (
            <>
              <Card title="Plan prices and labour rates (ex GST)" icon={DollarSign}>
                <div className="space-y-3">
                  {draft.membershipPlans.map(p => (
                    <div key={p.id} className="grid items-end gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_1fr_1fr]">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      {PLAN_NUMBERS.slice(0, 2).map(([k, label, min]) => (
                        <Field key={k} label={label} error={errors[`${k}-${p.id}`]}><input type="number" min={min} className={inputCls} value={p[k] ?? ''} onChange={e => setPlan(p.id, k, num(e.target.value))} /></Field>
                      ))}
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Fees" icon={DollarSign}><div className="grid gap-3 md:grid-cols-2">{numberFields('pricing')}</div></Card>
              <Card title="Multi-site discounts (cl. 17.2)" icon={DollarSign}>
                <ul className="space-y-1 text-sm text-slate-700">
                  {(draft.multiSiteDiscounts || []).map((d, i) => <li key={i}>{d.min}–{d.max} sites: {d.percent}% off</li>)}
                  <li>More sites: custom pricing</li>
                </ul>
              </Card>
            </>
          )}
          {section === 'plans' && (
            <Card title="What each plan includes" icon={ShieldCheck}>
              <div className="space-y-3">
                {draft.membershipPlans.map(p => (
                  <div key={p.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 font-bold text-slate-900">{p.name} <Badge className="ml-1">{p.id}</Badge> <span className="text-xs font-normal text-slate-500">{windowLabel(p)}</span></div>
                    <div className="grid items-end gap-3 md:grid-cols-3">
                      {PLAN_NUMBERS.slice(2).map(([k, label, min]) => (
                        <Field key={k} label={label} error={errors[`${k}-${p.id}`]}><input type="number" min={min} className={inputCls} value={p[k] ?? min} onChange={e => setPlan(p.id, k, num(e.target.value))} /></Field>
                      ))}
                      <Field label="Priority label"><input className={inputCls} value={p.priorityLabel || ''} onChange={e => setPlan(p.id, 'priorityLabel', e.target.value)} /></Field>
                      <Field label="Service window">
                        <select className={inputCls} value={p.window ? 'limited' : '247'} onChange={e => setPlan(p.id, 'window', e.target.value === '247' ? null : { start: 6, end: 21 })}>
                          <option value="247">24/7</option><option value="limited">Limited hours</option>
                        </select>
                      </Field>
                      {p.window && (
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="From (hour)"><input type="number" min="0" max="23" className={inputCls} value={p.window.start} onChange={e => setPlan(p.id, 'window', { ...p.window, start: Number(e.target.value) })} /></Field>
                          <Field label="To (hour)"><input type="number" min="1" max="24" className={inputCls} value={p.window.end} onChange={e => setPlan(p.id, 'window', { ...p.window, end: Number(e.target.value) })} /></Field>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={Boolean(p.afterHoursSurcharge)} onChange={e => setPlan(p.id, 'afterHoursSurcharge', e.target.checked)} />After-hours surcharge applies</label>
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={Boolean(p.publicHolidaySurcharge)} onChange={e => setPlan(p.id, 'publicHolidaySurcharge', e.target.checked)} />Public holiday surcharge applies</label>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {section === 'rules' && (
            <>
              <Card title="Time limits and notice periods" icon={Clock}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Response target from (hours)" hint="cl. 13.1"><input type="number" min="0" className={inputCls} value={draft.responseTargetHours?.min ?? 2} onChange={e => setKey('responseTargetHours', { ...draft.responseTargetHours, min: num(e.target.value) })} /></Field>
                  <Field label="Response target to (hours)" hint="cl. 13.1"><input type="number" min="0" className={inputCls} value={draft.responseTargetHours?.max ?? 4} onChange={e => setKey('responseTargetHours', { ...draft.responseTargetHours, max: num(e.target.value) })} /></Field>
                  {numberFields('rules')}
                </div>
              </Card>
              <Card title="Coverage limits (cl. 9.1)" icon={ShieldCheck}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Clean water, up to (m²)"><input type="number" min="0" className={inputCls} value={draft.coverageLimits?.cleanWaterM2 ?? ''} onChange={e => setKey('coverageLimits', { ...draft.coverageLimits, cleanWaterM2: num(e.target.value) })} /></Field>
                  <Field label="Graffiti, up to (m²)"><input type="number" min="0" className={inputCls} value={draft.coverageLimits?.graffitiM2 ?? ''} onChange={e => setKey('coverageLimits', { ...draft.coverageLimits, graffitiM2: num(e.target.value) })} /></Field>
                </div>
              </Card>
              <Card title="Toilet overflow notice" icon={FileText}>
                <Field label="Shown to customers who pick “Toilet overflow”"><textarea rows={3} className={inputCls} value={draft.toiletOverflowDisclaimer} onChange={e => setKey('toiletOverflowDisclaimer', e.target.value)} /></Field>
              </Card>
              <Card title="Incident types" icon={FileText}>
                <Field label="One per line" error={errors.incidentCategories}><textarea rows={8} className={inputCls} value={(draft.incidentCategories || []).join('\n')} onChange={e => setKey('incidentCategories', lines(e.target.value))} /></Field>
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Card title="SA public holidays" icon={CalendarDays}>
                  <Field label="One date per line (YYYY-MM-DD)" hint="Used for the public holiday surcharge"><textarea rows={8} className={cx(inputCls, 'font-mono')} value={(draft.publicHolidays || []).join('\n')} onChange={e => setKey('publicHolidays', lines(e.target.value).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))} /></Field>
                </Card>
                <Card title="Metro Adelaide postcodes" icon={MapPin}>
                  <Field label="One range per line, e.g. 5000-5115" hint="cl. 18.1: other SA postcodes need approval and travel"><textarea rows={8} className={cx(inputCls, 'font-mono')} defaultValue={rangesText(draft.metroPostcodes?.ranges)} onBlur={e => setKey('metroPostcodes', { ranges: parseRanges(e.target.value) })} /></Field>
                </Card>
              </div>
            </>
          )}
          {section === 'rewards' && (
            <>
              <Card title="Points rules" icon={Gift}>
                <p className="mb-3 text-sm text-slate-600">1 point is earned per $1 of membership fees (ex GST) and is worth $1 off periodical services.</p>
                <div className="grid gap-3 md:grid-cols-2">{numberFields('rewards')}</div>
              </Card>
              <Card title="Services points can be used for" icon={Gift}>
                <Field label="One per line" hint="SACC quotes each request"><textarea rows={5} className={inputCls}
                  value={(draft.redemptionServices || []).map(r => r.name).join('\n')}
                  onChange={e => setKey('redemptionServices', lines(e.target.value).map(name => ({ code: (draft.redemptionServices || []).find(r => r.name === name)?.code || name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name })))} /></Field>
              </Card>
              <Card title="Loyalty levels (cl. 15)" icon={Gift}>
                <ul className="space-y-1 text-sm text-slate-700">
                  {(draft.loyaltyLevels || []).map(l => <li key={l.id}><b>{l.name}</b> after {l.months} months: {l.benefit}</li>)}
                </ul>
              </Card>
            </>
          )}
          <StickyActions>
            {dirty && <span className="mr-auto basis-full text-xs font-semibold text-amber-700 sm:basis-auto">Unsaved changes</span>}
            <Button title="Undo the changes you have not saved" variant="ghost" icon={RotateCcw} disabled={!dirty} onClick={() => resetDraft(config)}>Discard</Button>
            <Button icon={Save} disabled={!dirty || saving} onClick={save} title="Save these settings. Customers see the new values straight away.">{saving ? 'Saving…' : 'Save settings'}</Button>
          </StickyActions>
        </div>
      </div>
    </Page>
  );
}
