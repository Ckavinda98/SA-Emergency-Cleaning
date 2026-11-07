// W8 Membership (plan, call-outs, billing, compare plans), Change plan, W9 Cancel membership and the
// digital Membership Card. Rules from the Membership Agreement v1.0 (clauses noted in the text).
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, AlertTriangle, HelpCircle, CreditCard, XCircle, IdCard, Award, MapPin } from 'lucide-react';
import { useAppData, useCustomerSummary } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Button, Badge, Alert, StickyActions, Field, InfoRow, inputCls, useToast, cx } from '@/shared/ui/index.jsx';
import { PlanCards, HotlineLink, LoyaltyBadge, fmtDate, fmtMoney } from '@/shared/ui/membership.jsx';
import { COMPANY, membershipFee } from '@shared/membership.js';

export function MembershipPage() {
  const s = useCustomerSummary();
  const { account, activePlan, config, membership: m } = s;
  const { hash } = useLocation();
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }); }, [hash]);
  const pendingPlan = (config.membershipPlans || []).find(p => p.id === m.pendingPlan);

  return (
    <Page title="Membership" subtitle="Your plan, call-outs and billing in one place" breadcrumb={[{ label: 'Dashboard', to: '/app' }, { label: 'Membership' }]} backTo={false}
      actions={<>
        {!s.cancelled && <Button title="Start cancelling your membership" to="/app/membership/cancel" variant="ghost">Cancel membership</Button>}
        <Button title="Show your digital membership card" to="/app/membership/card" variant="secondary" icon={IdCard}>Membership card</Button>
        {!s.cancelled && <Button title="Move to a different plan" to="/app/membership/change">Change plan</Button>}
      </>}>
      {s.suspended && <Alert tone="danger" className="mb-4">A membership payment is overdue, so included call-outs, member rates and priority response are paused until it is paid (cl. 4.4). Call <HotlineLink /> for help.</Alert>}
      {pendingPlan && <Alert tone="info" className="mb-4">Your plan changes to {pendingPlan.name} on {fmtDate(m.pendingPlanFrom)}, the start of your next billing period.</Alert>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Current plan" icon={ShieldCheck}>
          <div className="text-2xl font-extrabold text-slate-900">{activePlan?.name}</div>
          <div className="text-sm text-slate-500">{m.serviceWindow} · {m.priorityLabel} dispatch</div>
          <div className="mt-3 flex flex-wrap gap-2"><Badge tone={s.cancelled || s.suspended ? 'danger' : 'success'}>{s.cancelled ? 'Cancelled' : s.suspended ? 'Suspended' : 'Active'}</Badge><LoyaltyBadge level={m.loyaltyLevel} /></div>
          <dl className="mt-3 space-y-1 text-sm">
            <InfoRow label="Member since">{fmtDate(m.activationDate)} ({m.monthsActive} months)</InfoRow>
            <InfoRow label="Current term ends">{fmtDate(m.termEnds)} · renews automatically</InfoRow>
            <InfoRow label="Your rates">Extra labour {fmtMoney(m.labourRate)}/hr · extra call-out {fmtMoney(m.additionalCalloutFee)} (+ GST)</InfoRow>
            {m.ratesLockedUntil && <InfoRow label="Rates locked until">{fmtDate(m.ratesLockedUntil)}</InfoRow>}
          </dl>
        </Card>
        <Card title="Call-outs this month" icon={Clock}>
          <div className={cx('text-2xl font-extrabold', s.exhausted ? 'text-amber-600' : 'text-emerald-600')}>{s.remaining} of {s.included} left</div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full', s.exhausted ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${(s.remaining / (s.included || 1)) * 100}%` }} /></div>
          <p className="mt-2 text-xs text-slate-500">{s.used} used · resets on the 1st, in {m.daysUntilReset} day{m.daysUntilReset === 1 ? '' : 's'}{m.bonusCallouts ? ` · ${m.bonusCallouts} Gold bonus call-out` : ''}</p>
          {(m.sites || []).length > 1 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {m.sites.map(site => <li key={site.id} className="flex justify-between gap-2"><span className="truncate"><MapPin className="mr-1 inline h-3 w-3" />{site.name} ({site.planName})</span><span className="font-semibold">{site.remaining} of {site.included} left</span></li>)}
            </ul>
          )}
        </Card>
        <Card title="Billing" icon={CreditCard}>
          <div className="text-2xl font-extrabold text-slate-900">{fmtMoney(m.periodFee)}<span className="text-sm font-medium text-slate-500"> + GST / {m.billingFrequency === 'ANNUAL' ? 'year' : 'month'}</span></div>
          {m.fee?.discountPercent > 0 && <p className="text-xs text-emerald-700">Includes a {m.fee.discountPercent}% multi-site discount ({(m.sites || []).length} sites)</p>}
          {m.fee?.customPricing && <p className="text-xs text-slate-500">11 or more sites: ask us about custom pricing.</p>}
          <dl className="mt-3 space-y-1 text-sm">
            <InfoRow label="Paid by">{account.paymentMethod || 'PayTo direct debit'}</InfoRow>
            <InfoRow label="Next payment">{fmtDate(m.nextBillingDate)}</InfoRow>
          </dl>
          <p className="mt-2 text-xs text-slate-500">Extra charges from a visit (labour, surcharges, disposal, travel) are invoiced after the visit and due within 7 days.</p>
        </Card>
      </div>

      <Card id="callouts" title="How call-outs work" icon={HelpCircle} className="mt-4 scroll-mt-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
            <div className="mb-1 font-bold text-brand-dark">1. Included call-outs</div>
            Each site on your {activePlan?.name} plan gets {activePlan?.callouts} call-out(s) a month. Each covers the visit and the first hour of one technician. They reset on the 1st and do not roll over; each one you don't use becomes {config.unusedCalloutPoints} reward points.
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
            <div className="mb-1 font-bold text-emerald-700">2. When they run out</div>
            You can still ask for help any time. An extra call-out is {fmtMoney(m.additionalCalloutFee)} + GST and still includes the first hour. Labour after the first hour is {fmtMoney(m.labourRate)}/hr + GST per technician, in whole hours.
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
            <div className="mb-1 font-bold text-amber-800">3. Response time</div>
            We aim to arrive within 2–4 hours of acknowledging your request, inside your service window ({m.serviceWindow}). {m.surcharges}.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="mb-1 font-bold text-slate-800">4. Not covered</div>
            Bigger jobs (for example water over about 10 m², grey or black water, graffiti over 2 m²) are quoted separately and don't use a call-out. Cancelling after a technician is on the way, or no access on arrival, uses the call-out and costs {fmtMoney(config.lateCancellationFee)} + GST.
          </div>
        </div>
      </Card>

      <Card title="Compare plans" className="mt-4" actions={!s.cancelled && <Button to="/app/membership/change" variant="secondary" size="sm">Change plan</Button>}>
        <PlanCards plans={config.membershipPlans || []} config={config} current={account.membershipPlan} pending={m.pendingPlan} selected={account.membershipPlan} />
        <p className="mt-3 text-xs text-slate-500">All prices exclude GST. Discounts for more than one site: 10% for 2–5 sites, 15% for 6–10 sites, custom pricing for 11 or more.</p>
      </Card>
    </Page>
  );
}

export function ChangePlanPage() {
  const s = useCustomerSummary();
  const { account, config, membership: m } = s;
  const { upsertCustomer } = useAppData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(m.pendingPlan || account.membershipPlan || 'business');
  const [saving, setSaving] = useState(false);
  const plans = config.membershipPlans || [];
  const plan = plans.find(p => p.id === selected);
  const sitePlans = (planId) => (account.locations || []).map(l => l.membershipPlan || planId);
  const newFee = membershipFee(sitePlans(selected).length ? sitePlans(selected) : [selected], config).monthly;
  const upgrade = newFee > (m.fee?.monthly ?? 0);
  const unchanged = selected === account.membershipPlan && !m.pendingPlan;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/plan`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ membershipPlan: selected })
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'The plan could not be changed.', 'danger'); setSaving(false); return; }
      upsertCustomer(data.customer);
      notify(data.message);
      navigate('/app/membership');
    } catch {
      notify('Cannot reach the server. Your plan was not changed.', 'danger');
      setSaving(false);
    }
  };

  const summary = unchanged ? 'This is your current plan.'
    : selected === account.membershipPlan ? 'Keep your current plan and cancel the scheduled change.'
      : upgrade ? `Upgrade now: ${fmtMoney(newFee)}/month + GST from today. The difference for the rest of this billing period is charged pro-rata.`
        : `Downgrade from ${fmtDate(m.nextBillingDate)} (your next billing period): ${fmtMoney(newFee)}/month + GST. Call-outs already used this month are not affected.`;

  return (
    <Page title="Change plan" subtitle={`Choose a new membership plan for ${account.businessName}`} width="medium"
      breadcrumb={[{ label: 'Membership', to: '/app/membership' }, { label: 'Change plan' }]}>
      <PlanCards plans={plans} config={config} current={account.membershipPlan} pending={m.pendingPlan} selected={selected} onSelect={setSelected} />
      <p className="mt-3 text-xs text-slate-500">Changing plan does not restart your membership term or your loyalty level (cl. 6.4).</p>
      <StickyActions>
        <span className="mr-auto text-sm text-slate-600">{summary}</span>
        <Button title="Go back without changing your plan" variant="ghost" to="/app/membership">Cancel</Button>
        <Button title={`Switch to the ${plan?.name} plan`} onClick={save} disabled={saving || unchanged}>{saving ? 'Saving…' : upgrade ? 'Upgrade now' : 'Confirm plan change'}</Button>
      </StickyActions>
    </Page>
  );
}

export function CancelMembershipPage() {
  const s = useCustomerSummary();
  const { account, membership: m } = s;
  const { upsertCustomer } = useAppData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (s.cancelled) {
    return <Page title="Membership cancelled" width="medium" breadcrumb={[{ label: 'Membership', to: '/app/membership' }, { label: 'Cancel' }]}>
      <Alert tone="info">This membership is cancelled. To rejoin, call <HotlineLink />.</Alert>
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
      notify(data.message || 'Your membership has been cancelled.');
      navigate('/app');
    } catch {
      notify('Cannot reach the server. Your membership was not cancelled.', 'danger');
      setBusy(false);
    }
  };

  return (
    <Page title="Cancel membership" subtitle={account.businessName} width="medium"
      breadcrumb={[{ label: 'Membership', to: '/app/membership' }, { label: 'Cancel' }]}>
      {!m.canCancel && (
        <Alert tone="warning" className="mb-4">A membership can be cancelled once 30 days have passed since your last call-out (cl. 5.2). You can cancel from {fmtDate(m.cancelFrom)}.</Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card tone="danger" title="What happens" icon={AlertTriangle}>
          <ul className="space-y-2 text-sm text-red-900">
            <li className="flex gap-2"><XCircle className="h-4 w-4 shrink-0" />Included call-outs, member rates and priority response end.</li>
            <li className="flex gap-2"><XCircle className="h-4 w-4 shrink-0" />All {account.pointsBalance ?? 0} reward points are cancelled and cannot be used.</li>
            <li className="flex gap-2"><CreditCard className="h-4 w-4 shrink-0" />The prepaid, unused part of your fee is refunded pro-rata: about {fmtMoney(m.refundIfCancelledToday)} + GST if you cancel today.</li>
          </ul>
        </Card>
        <Card title="Before you go">
          <p className="text-sm text-slate-600">If the price is the issue, a smaller plan keeps priority attendance for less. Downgrades start from your next billing period.</p>
          <Button title="Compare cheaper plans before you cancel" to="/app/membership/change" variant="secondary" className="mt-3">See smaller plans</Button>
        </Card>
        <Card title="Why are you leaving? (optional)" className="md:col-span-2">
          <Field label="Reason"><textarea rows={2} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="Tell us what we could do better" /></Field>
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" disabled={!m.canCancel} />
            I understand my reward points will be cancelled, and I want to cancel this membership.
          </label>
        </Card>
      </div>
      <StickyActions>
        <Button title="Keep your membership and go back" variant="secondary" to="/app/membership">Keep membership</Button>
        <Button title="Cancel your membership for good" variant="danger" disabled={!confirmed || busy || !m.canCancel} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel membership'}</Button>
      </StickyActions>
    </Page>
  );
}

// Digital Membership Card (cl. 19.2): membership number, level, the 24/7 hotline and emergency contacts.
// The QR code linking to the portal is added once the portal has its public address (cl. 19.2).
export function MembershipCardPage() {
  const s = useCustomerSummary();
  const { account, activePlan, membership: m } = s;
  return (
    <Page title="Membership card" subtitle="Show this card or quote your number when you call" width="medium"
      breadcrumb={[{ label: 'Membership', to: '/app/membership' }, { label: 'Card' }]}>
      <div className="mx-auto max-w-md rounded-3xl bg-gradient-to-br from-brand-dark to-brand p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-sky-100">{COMPANY.legalName}</div>
            <div className="mt-1 text-lg font-extrabold">Emergency Cleaning Membership</div>
          </div>
          <Award className="h-8 w-8 text-amber-300" />
        </div>
        <div className="mt-6 text-2xl font-extrabold tracking-wider">{account.membershipNumber || 'Number pending'}</div>
        <div className="mt-1 text-sm text-sky-100">{account.businessName}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs uppercase text-sky-200">Plan</div><div className="font-bold">{activePlan?.name}</div></div>
          <div><div className="text-xs uppercase text-sky-200">Level</div><div className="font-bold">{m.loyaltyLevel || 'Member'}</div></div>
          <div><div className="text-xs uppercase text-sky-200">Member since</div><div className="font-bold">{fmtDate(m.activationDate)}</div></div>
          <div><div className="text-xs uppercase text-sky-200">Status</div><div className="font-bold">{s.cancelled ? 'Cancelled' : s.suspended ? 'Suspended' : 'Active'}</div></div>
        </div>
        <div className="mt-6 rounded-2xl bg-white/10 p-3">
          <div className="text-xs uppercase text-sky-200">24/7 Emergency Hotline</div>
          <HotlineLink light className="text-xl" />
          <div className="mt-1 text-xs text-sky-100">Primary contact: {account.primaryContactName} · {account.phoneNumber}</div>
        </div>
      </div>
      <Card title="Your referral code" icon={IdCard} className="mx-auto mt-4 max-w-md">
        <p className="text-sm text-slate-600">When a business you refer joins and pays its first fee, you get 100 reward points. There is no limit.</p>
        <div className="mt-2 inline-block rounded-xl border border-dashed border-brand px-4 py-2 font-mono text-lg font-bold text-brand-dark">{account.referralCode || '–'}</div>
      </Card>
    </Page>
  );
}
