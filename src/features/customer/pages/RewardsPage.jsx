// W7 Reward points (Agreement cl. 14, 15): balance and points history with expiry dates, the eligible
// periodical services (1 point = $1 against SACC's quote), how to earn points, and service requests.
import React, { useEffect, useState } from 'react';
import { Award, History, Gift, Users, Clock } from 'lucide-react';
import { useAppData, useCustomerSummary } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Kpi, Button, Badge, Alert, EmptyState, Field, inputCls, useToast, InlineConfirm } from '@/shared/ui/index.jsx';
import { formatDateTime } from '@/shared/ui/jobs.jsx';
import { fmtDate, fmtMoney, LoyaltyBadge } from '@/shared/ui/membership.jsx';

const REASONS = {
  OPENING: 'Opening balance', FEES: 'Membership fee', UNUSED_CALLOUT: 'Unused call-outs', REFERRAL: 'Referral', GOODWILL: 'Late arrival credit',
  REDEMPTION: 'Used for a service', REDEMPTION_RESTORED: 'Returned (service cancelled)', EXPIRED: 'Expired', CANCELLED: 'Membership cancelled', ADJUSTMENT: 'Adjustment'
};
const STATUS = {
  PENDING_APPROVAL: { label: 'Waiting for a quote', tone: 'warning' },
  APPROVED: { label: 'Booked', tone: 'success' },
  REJECTED: { label: 'Declined', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' }
};

export function RewardsPage() {
  const s = useCustomerSummary();
  const { account, config, membership: m } = s;
  const { loadData } = useAppData();
  const { notify } = useToast();
  const [history, setHistory] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [r1, r2] = await Promise.all([fetch(`${API_BASE}/redemptions`), fetch(`${API_BASE}/customers/${account.id}/points`)]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      if (r1.ok && Array.isArray(d1)) setHistory(d1.filter(r => r.organizationId === account.id));
      if (r2.ok && Array.isArray(d2)) setLedger(d2);
    } catch { /* offline: show empty history */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, [account?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextExpiry = ledger.filter(e => e.points > 0 && e.remaining > 0 && e.expiresAt).sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0];
  const withdraw = async (r) => {
    const res = await fetch(`${API_BASE}/redemptions/${r.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) });
    const data = await res.json();
    if (!res.ok) notify(data.error || 'Could not cancel the request.', 'danger'); else { notify('Request withdrawn.'); load(); loadData(); }
  };

  return (
    <Page title="Reward points" subtitle="1 point = $1 off periodical cleaning services"
      breadcrumb={[{ label: 'Dashboard', to: '/app' }, { label: 'Rewards' }]} backTo={false}>
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Points balance" value={`${account.pointsBalance ?? 0} pts`} icon={Award} tone="rewards"
          sub={nextExpiry ? `${nextExpiry.remaining} pts expire ${fmtDate(nextExpiry.expiresAt)}` : 'Points expire 12 months after they are earned'}
          to="#ledger" title="See where your points came from" />
        <Kpi label="Membership" value={`${m.monthsActive ?? 0} months`} icon={Clock} tone="slate" to="/app/membership" title="Open your membership"
          sub={s.tenureUnlocked ? 'Points can be used' : `Points usable from ${fmtDate(m.redeemUnlocksOn)}`} action={<LoyaltyBadge level={m.loyaltyLevel} />} />
        <Card title="How you earn points" icon={Gift}>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>1 point for every $1 of membership fees (ex GST)</li>
            <li>{config.unusedCalloutPoints} points for each included call-out you don't use in a month</li>
            <li>{config.referralPoints} points for each business you refer that joins</li>
            <li>{config.goodwillPoints} points if we arrive more than 4 hours late for reasons within our control</li>
          </ul>
        </Card>
      </div>

      {!s.tenureUnlocked && <Alert tone="warning" className="mt-4">Points can be used after {config.tenureMinMonths} consecutive months of membership, from {fmtDate(m.redeemUnlocksOn)}. You keep earning until then.</Alert>}
      {m.loyaltyLevel && <Alert tone="info" className="mt-4">{m.loyaltyLevel} level: {m.loyaltyBenefit}.</Alert>}

      <h2 className="mb-3 mt-6 text-base font-bold text-slate-900">Use your points</h2>
      <RequestService account={account} config={config} locked={!s.tenureUnlocked || !(account.pointsBalance > 0) || s.cancelled || s.suspended} onDone={() => { load(); loadData(); }} />

      <Card id="history" title="Your service requests" icon={History} className="mt-6 scroll-mt-4">
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : history.length === 0 ? <EmptyState title="No requests yet" /> : (
          <ul className="divide-y divide-slate-100">
            {history.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{r.serviceName}{r.notes ? ` · ${r.notes}` : ''}</div>
                  <div className="text-xs text-slate-500">{r.location?.name || ''} · {formatDateTime(r.createdAt)}
                    {r.quoteAmount ? ` · price ${fmtMoney(r.quoteAmount)}${r.discountPercent ? ` less ${r.discountPercent}%` : ''}${r.balanceDue ? ` · ${fmtMoney(r.balanceDue)} + GST to pay` : ''}` : ''}
                    {r.scheduledFor ? ` · booked for ${fmtDate(r.scheduledFor)}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.calculatedPoints > 0 && <span className="text-sm font-bold text-purple-700">{r.calculatedPoints} pts</span>}
                  <Badge tone={STATUS[r.status]?.tone || 'slate'}>{STATUS[r.status]?.label || r.status}</Badge>
                  {r.status === 'PENDING_APPROVAL' && <InlineConfirm label="Withdraw" message="Withdraw this request?" confirmLabel="Withdraw" onConfirm={() => withdraw(r)} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="ledger" title="Points history" icon={Users} className="mt-6 scroll-mt-4">
        {ledger.length === 0 ? <EmptyState title="No points yet" /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Date</th><th>What</th><th className="text-right">Points</th><th className="hidden text-right sm:table-cell">Expires</th></tr></thead>
            <tbody>
              {ledger.map(e => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-600">{fmtDate(e.createdAt)}</td>
                  <td className="text-slate-800">{REASONS[e.reason] || e.reason}{e.note ? <span className="text-slate-500"> · {e.note}</span> : null}</td>
                  <td className={`text-right font-semibold tabular-nums ${e.points < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{e.points > 0 ? '+' : ''}{e.points}</td>
                  <td className="hidden text-right text-slate-500 sm:table-cell">{e.points > 0 && e.remaining > 0 ? fmtDate(e.expiresAt) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Page>
  );
}

function RequestService({ account, config, locked, onDone }) {
  const { notify } = useToast();
  const services = config.redemptionServices || [];
  const [code, setCode] = useState(services[0]?.code || '');
  const [site, setSite] = useState(account.locations?.[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/redemptions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceCode: code, locationId: site, notes, organizationId: account.id })
      });
      const data = await res.json();
      if (!res.ok) notify(data.error || 'The request could not be sent.', 'danger');
      else { notify(data.message); setNotes(''); onDone(); }
    } catch { notify('Cannot reach the server. Nothing was sent.', 'danger'); }
    setBusy(false);
  };

  return (
    <Card>
      <p className="text-sm text-slate-600">Choose a periodical service. SACC sends you a price, books it, and takes your points off at booking: points can pay for part or all of it. If SACC has to cancel, your points come back.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label="Service">
          <select className={inputCls} value={code} onChange={e => setCode(e.target.value)} disabled={locked}>
            {services.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Site">
          <select className={inputCls} value={site} onChange={e => setSite(e.target.value)} disabled={locked}>
            {(account.locations || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="What needs doing">
          <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} disabled={locked} placeholder="e.g. boardroom carpet, about 50 m²" />
        </Field>
      </div>
      <Button className="mt-3" variant="rewards" disabled={locked || busy || !code || !site} onClick={send} title="Ask SACC to quote and book this service with your points">{busy ? 'Sending…' : 'Ask for a quote'}</Button>
    </Card>
  );
}
