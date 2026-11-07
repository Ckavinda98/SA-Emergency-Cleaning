// W22 Settings (was Config Studio): pricing, plans, service rules and reward rates, each with its own URL.
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { DollarSign, ShieldCheck, FileText, Gift, Save, RotateCcw } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Button, Field, Badge, StickyActions, inputCls, useToast, useFieldErrors, cx } from '@/shared/ui/index.jsx';
import { numberError } from '@shared/validation.js';

const SECTIONS = [
  { key: 'pricing', label: 'Pricing', icon: DollarSign },
  { key: 'plans', label: 'Plans', icon: ShieldCheck },
  { key: 'rules', label: 'Service rules', icon: FileText },
  { key: 'rewards', label: 'Reward rates', icon: Gift }
];

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
  const current = SECTIONS.find(s => s.key === section);
  if (!current) return <Navigate to="/settings/pricing" replace />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);
  const setPlan = (id, key, value) => setDraft(d => ({ ...d, membershipPlans: d.membershipPlans.map(p => p.id === id ? { ...p, [key]: value } : p) }));
  const setRate = (code, value) => setDraft(d => ({ ...d, redemptionRates: d.redemptionRates.map(r => r.code === code ? { ...r, points: value } : r) }));
  const num = (v) => (v === '' ? '' : Number(v));

  const { errors, check } = useFieldErrors();
  // Every price, count and rate must be a number of 0 or more (hours per call-out at least 1)
  const validate = () => {
    const rules = {
      additionalCalloutFee: d => numberError(d.additionalCalloutFee, { label: 'Extra call-out fee', min: 0 }),
      overageHourlyRate: d => numberError(d.overageHourlyRate, { label: 'Extra labour rate', min: 0 }),
      tenureMinMonths: d => numberError(d.tenureMinMonths, { label: 'Months', min: 0, max: 120 }),
      incidentCategories: d => ((d.incidentCategories || []).length ? '' : 'Add at least one incident type.')
    };
    (draft.membershipPlans || []).forEach(p => {
      rules[`price-${p.id}`] = () => numberError(p.price, { label: 'Price', min: 0 });
      rules[`callouts-${p.id}`] = () => numberError(p.callouts, { label: 'Call-outs', min: 0 });
      rules[`hours-${p.id}`] = () => numberError(p.hoursPerCallout ?? 1, { label: 'Hours', min: 1 });
    });
    (draft.redemptionRates || []).forEach(r => { rules[`rate-${r.code}`] = () => numberError(r.points, { label: 'Points', min: 0 }); });
    return check(rules, draft);
  };

  const save = async () => {
    if (!validate()) { notify('Some values need fixing. They are marked in red.', 'danger'); return; }
    const clean = {
      ...draft,
      additionalCalloutFee: Number(draft.additionalCalloutFee) || 0,
      overageHourlyRate: Number(draft.overageHourlyRate) || 0,
      tenureMinMonths: Number(draft.tenureMinMonths) || 0,
      membershipPlans: draft.membershipPlans.map(p => ({ ...p, price: Number(p.price) || 0, callouts: Number(p.callouts) || 0, hoursPerCallout: Number(p.hoursPerCallout) || 1 })),
      redemptionRates: draft.redemptionRates.map(r => ({ ...r, points: Number(r.points) || 0 }))
    };
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) notify(data.error || 'The settings were not saved.', 'danger');
      else { setConfig(clean); resetDraft(clean); notify('Settings saved. Customers see the new values straight away.'); }
    } catch { notify('Cannot reach the server. The settings were not saved.', 'danger'); }
    setSaving(false);
  };

  return (
    <Page title="Settings" subtitle="Prices and business rules used across the app" breadcrumb={[{ label: 'Settings' }, { label: current.label }]}>
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
              <Card title="Monthly plan prices" icon={DollarSign}>
                <div className="grid gap-3 md:grid-cols-3">
                  {draft.membershipPlans.map(p => (
                    <Field key={p.id} label={`${p.name} ($/month)`} error={errors[`price-${p.id}`]}><input type="number" min="0" className={inputCls} value={p.price} onChange={e => setPlan(p.id, 'price', num(e.target.value))} /></Field>
                  ))}
                </div>
              </Card>
              <Card title="Extra charges" icon={DollarSign}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Extra call-out fee ($)" error={errors.additionalCalloutFee} hint="Charged when the monthly call-outs are used up"><input type="number" min="0" className={inputCls} value={draft.additionalCalloutFee} onChange={e => setDraft({ ...draft, additionalCalloutFee: num(e.target.value) })} /></Field>
                  <Field label="Extra labour ($/hour)" error={errors.overageHourlyRate}><input type="number" min="0" className={inputCls} value={draft.overageHourlyRate} onChange={e => setDraft({ ...draft, overageHourlyRate: num(e.target.value) })} /></Field>
                </div>
              </Card>
              <Card title="Preview: what customers see">
                <div className="grid gap-3 md:grid-cols-3">
                  {draft.membershipPlans.map(p => (
                    <div key={p.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-2xl font-extrabold text-brand">${p.price || 0}<span className="text-sm font-medium text-slate-500">/month</span></div>
                      <div className="mt-1 text-xs text-slate-500">{p.callouts} call-outs · then ${draft.additionalCalloutFee} + ${draft.overageHourlyRate}/hr</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
          {section === 'plans' && (
            <Card title="What each plan includes" icon={ShieldCheck}>
              <div className="space-y-3">
                {draft.membershipPlans.map(p => (
                  <div key={p.id} className="grid items-end gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_1fr_1fr]">
                    <div className="font-bold text-slate-900">{p.name} <Badge className="ml-1">{p.id}</Badge></div>
                    <Field label="Call-outs per month" error={errors[`callouts-${p.id}`]}><input type="number" min="0" className={inputCls} value={p.callouts} onChange={e => setPlan(p.id, 'callouts', num(e.target.value))} /></Field>
                    <Field label="Hours per call-out" error={errors[`hours-${p.id}`]}><input type="number" min="1" className={inputCls} value={p.hoursPerCallout ?? 1} onChange={e => setPlan(p.id, 'hoursPerCallout', num(e.target.value))} /></Field>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {section === 'rules' && (
            <>
              <Card title="Toilet overflow notice" icon={FileText}>
                <Field label="Shown to customers who pick “Toilet overflow”"><textarea rows={3} className={inputCls} value={draft.toiletOverflowDisclaimer} onChange={e => setDraft({ ...draft, toiletOverflowDisclaimer: e.target.value })} /></Field>
              </Card>
              <Card title="Incident types" icon={FileText}>
                <Field label="One per line" error={errors.incidentCategories}><textarea rows={8} className={inputCls} value={(draft.incidentCategories || []).join('\n')} onChange={e => setDraft({ ...draft, incidentCategories: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} /></Field>
              </Card>
            </>
          )}
          {section === 'rewards' && (
            <>
              <Card title="When points unlock" icon={Gift}>
                <Field label="Months of membership before points can be used" className="max-w-xs" error={errors.tenureMinMonths}><input type="number" min="0" className={inputCls} value={draft.tenureMinMonths} onChange={e => setDraft({ ...draft, tenureMinMonths: num(e.target.value) })} /></Field>
              </Card>
              <Card title="Points per unit" icon={Gift}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {draft.redemptionRates.map(r => (
                    <Field key={r.code} label={`${r.name} (per ${r.unit})`} error={errors[`rate-${r.code}`]}><input type="number" min="0" className={inputCls} value={r.points} onChange={e => setRate(r.code, num(e.target.value))} /></Field>
                  ))}
                </div>
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
