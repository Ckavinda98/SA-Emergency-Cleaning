// W8 Membership (plan, call-outs explained, compare plans), Change plan and W9 Cancel membership.
// Replaces ChangePlanModal, CalloutExplanationModal and CancelSubscriptionModal.
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, AlertTriangle, CheckCircle2, HelpCircle, CreditCard, XCircle } from 'lucide-react';
import { useAppData, useCustomerSummary } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Button, Badge, Alert, StickyActions, Field, inputCls, useToast, cx } from '@/shared/ui/index.jsx';

function PlanCards({ plans, current, selected, onSelect }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
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
            </div>
            <div className="mt-1 text-2xl font-extrabold text-brand">${p.price}<span className="text-sm font-medium text-slate-500">/month</span></div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{p.callouts} emergency call-out{p.callouts > 1 ? 's' : ''} a month</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />Up to {p.hoursPerCallout || 1} hour labour each</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />2–4 hour priority attendance</li>
            </ul>
          </Tag>
        );
      })}
    </div>
  );
}

export function MembershipPage() {
  const s = useCustomerSummary();
  const { account, activePlan, config } = s;
  const { hash } = useLocation();
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }); }, [hash]);

  return (
    <Page title="Membership" subtitle="Your plan, call-outs and billing in one place" breadcrumb={[{ label: 'Dashboard', to: '/app' }, { label: 'Membership' }]} backTo={false}
      actions={<>
        {!s.cancelled && <Button to="/app/membership/cancel" variant="ghost">Cancel membership</Button>}
        <Button to="/app/membership/change">Change plan</Button>
      </>}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Current plan" icon={ShieldCheck}>
          <div className="text-2xl font-extrabold text-slate-900">{activePlan?.name}</div>
          <div className="text-sm text-slate-500">${activePlan?.price}/month · {activePlan?.callouts} call-outs included</div>
          <div className="mt-3"><Badge tone={s.cancelled ? 'danger' : 'success'}>{s.cancelled ? 'Cancelled' : 'Active'}</Badge></div>
        </Card>
        <Card title="Call-outs this month" icon={Clock}>
          <div className={cx('text-2xl font-extrabold', s.exhausted ? 'text-amber-600' : 'text-emerald-600')}>{s.remaining} of {s.included} left</div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full', s.exhausted ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${(s.remaining / (s.included || 1)) * 100}%` }} /></div>
          <p className="mt-2 text-xs text-slate-500">{s.used} used · resets in 12 days</p>
        </Card>
        <Card title="Billing" icon={CreditCard}>
          <div className="text-sm font-semibold text-slate-900">{account.paymentMethod || 'PayTo direct debit'}</div>
          <p className="mt-1 text-xs text-slate-500">Charged monthly. Extra call-outs are added to your next bill.</p>
        </Card>
      </div>

      <Card id="callouts" title="How call-outs work" icon={HelpCircle} className="mt-4 scroll-mt-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
            <div className="mb-1 font-bold text-brand-dark">1. Included call-outs</div>
            Your {activePlan?.name} plan (${activePlan?.price}/mo) includes {activePlan?.callouts} call-out(s) a month, each with up to 1 hour of cleaning at no extra charge.
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
            <div className="mb-1 font-bold text-emerald-700">2. Your balance</div>
            You have used {s.used} of {s.included} this billing month. The balance resets automatically in 12 days.
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
            <div className="mb-1 font-bold text-amber-800">3. When they run out</div>
            You can still ask for help any time. Extra call-outs cost ${config.additionalCalloutFee} plus ${config.overageHourlyRate}/hr labour.
          </div>
        </div>
      </Card>

      <Card title="Compare plans" className="mt-4" actions={<Button to="/app/membership/change" variant="secondary" size="sm">Change plan</Button>}>
        <PlanCards plans={config.membershipPlans || []} current={account.membershipPlan} selected={account.membershipPlan} />
      </Card>
    </Page>
  );
}

export function ChangePlanPage() {
  const s = useCustomerSummary();
  const { account, config } = s;
  const { upsertCustomer } = useAppData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(account.membershipPlan || 'business');
  const [saving, setSaving] = useState(false);
  const plan = (config.membershipPlans || []).find(p => p.id === selected);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/plan`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ membershipPlan: selected })
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'The plan could not be changed.', 'danger'); setSaving(false); return; }
      upsertCustomer(data.customer || { ...account, membershipPlan: selected });
      notify(`You are now on the ${plan?.name} plan.`);
      navigate('/app/membership');
    } catch {
      notify('Cannot reach the server. Your plan was not changed.', 'danger');
      setSaving(false);
    }
  };

  return (
    <Page title="Change plan" subtitle={`Choose a new membership plan for ${account.businessName}`} width="medium"
      breadcrumb={[{ label: 'Membership', to: '/app/membership' }, { label: 'Change plan' }]}>
      <PlanCards plans={config.membershipPlans || []} current={account.membershipPlan} selected={selected} onSelect={setSelected} />
      <StickyActions>
        <span className="mr-auto text-sm text-slate-600">{selected === account.membershipPlan ? 'This is your current plan.' : `New price: $${plan?.price}/month from your next bill.`}</span>
        <Button variant="ghost" to="/app/membership">Cancel</Button>
        <Button onClick={save} disabled={saving || selected === account.membershipPlan}>{saving ? 'Saving…' : 'Confirm plan change'}</Button>
      </StickyActions>
    </Page>
  );
}

export function CancelMembershipPage() {
  const s = useCustomerSummary();
  const { account } = s;
  const { upsertCustomer } = useAppData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (s.cancelled) {
    return <Page title="Membership cancelled" width="medium" breadcrumb={[{ label: 'Membership', to: '/app/membership' }, { label: 'Cancel' }]}>
      <Alert tone="info">This membership is already cancelled. Choose a plan to restart priority attendance.</Alert>
      <Button to="/app/membership/change" className="mt-4">Choose a plan</Button>
    </Page>;
  }

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/cancel-subscription`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'The membership could not be cancelled.', 'danger'); setBusy(false); return; }
      upsertCustomer(data.customer || { ...account, subscriptionStatus: 'CANCELLED' });
      notify('Your membership has been cancelled.');
      navigate('/app');
    } catch {
      notify('Cannot reach the server. Your membership was not cancelled.', 'danger');
      setBusy(false);
    }
  };

  return (
    <Page title="Cancel membership" subtitle={account.businessName} width="medium"
      breadcrumb={[{ label: 'Membership', to: '/app/membership' }, { label: 'Cancel' }]}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card tone="danger" title="What you will lose" icon={AlertTriangle}>
          <ul className="space-y-2 text-sm text-red-900">
            <li className="flex gap-2"><XCircle className="h-4 w-4 shrink-0" />Your 2–4 hour priority attendance is switched off.</li>
            <li className="flex gap-2"><XCircle className="h-4 w-4 shrink-0" />Your {account.pointsBalance ?? 0} reward points are frozen.</li>
            <li className="flex gap-2"><XCircle className="h-4 w-4 shrink-0" />Remaining call-outs this month are lost.</li>
          </ul>
        </Card>
        <Card title="Before you go">
          <p className="text-sm text-slate-600">If the price is the issue, a smaller plan keeps priority attendance for less.</p>
          <Button to="/app/membership/change" variant="secondary" className="mt-3">See smaller plans</Button>
        </Card>
        <Card title="Why are you leaving? (optional)" className="md:col-span-2">
          <Field label="Reason"><textarea rows={2} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="Tell us what we could do better" /></Field>
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" />
            I confirm I want to cancel this membership.
          </label>
        </Card>
      </div>
      <StickyActions>
        <Button variant="secondary" to="/app/membership">Keep membership</Button>
        <Button variant="danger" disabled={!confirmed || busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel membership'}</Button>
      </StickyActions>
    </Page>
  );
}
