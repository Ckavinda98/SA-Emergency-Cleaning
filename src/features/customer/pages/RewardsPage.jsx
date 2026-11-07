// W7 Reward points: balance, catalog with in-card redeem, and redemption history (was PointsRedemptionModal)
import React, { useEffect, useState } from 'react';
import { Award, Lock, History, Gift } from 'lucide-react';
import { useAppData, useCustomerSummary } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Kpi, Button, Badge, Alert, EmptyState, inputCls, useToast } from '@/shared/ui/index.jsx';
import { formatDateTime } from '@/shared/ui/jobs.jsx';
import { redemptionPoints } from '@shared/config.js';

export function RewardsPage() {
  const s = useCustomerSummary();
  const { account, config } = s;
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/redemptions`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setHistory(data.filter(r => r.organizationId === account.id));
    } catch { /* offline: show empty history */ }
    setLoading(false);
  };
  useEffect(() => { loadHistory(); }, [account?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = history.filter(r => r.status === 'PENDING_APPROVAL').reduce((n, r) => n + (r.calculatedPoints || 0), 0);

  return (
    <Page title="Reward points" subtitle="Turn your membership points into free periodic cleaning"
      breadcrumb={[{ label: 'Dashboard', to: '/app' }, { label: 'Rewards' }]} backTo={false}>
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Points balance" value={`${account.pointsBalance ?? 0} pts`} icon={Award} tone="rewards" sub={pending ? `${pending} pts waiting for approval` : 'Ready to use'} />
        <Kpi label="Membership length" value={`${account.consecutiveMonths || 0} months`} icon={History} tone="slate"
          sub={s.tenureUnlocked ? 'Redemptions unlocked' : `Redemptions unlock at ${config.tenureMinMonths} months`} />
        <Card title="How it works" icon={Gift} className="md:col-span-1">
          <p className="text-sm text-slate-600">Pick a service, enter how much you need and send it. Points are only taken off when our team approves the booking.</p>
        </Card>
      </div>

      {!s.tenureUnlocked && <Alert tone="warning" className="mt-4">Redemptions unlock after {config.tenureMinMonths} months of continuous membership. You have {account.consecutiveMonths || 0}.</Alert>}

      <h2 className="mb-3 mt-6 text-base font-bold text-slate-900">Catalog</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {(config.redemptionRates || []).map(rate => (
          <RewardCard key={rate.code} rate={rate} account={account} locked={!s.tenureUnlocked} onDone={loadHistory} />
        ))}
      </div>

      <Card title="Redemption history" icon={History} className="mt-6">
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : history.length === 0 ? <EmptyState title="No redemptions yet" /> : (
          <ul className="divide-y divide-slate-100">
            {history.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{r.serviceName} · {r.quantity}</div>
                  <div className="text-xs text-slate-500">{r.location?.name || ''} · {formatDateTime(r.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-purple-700">{r.calculatedPoints} pts</span>
                  <Badge tone={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}>
                    {r.status === 'PENDING_APPROVAL' ? 'Waiting for approval' : r.status === 'APPROVED' ? 'Approved' : 'Declined'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}

function RewardCard({ rate, account, locked, onDone }) {
  const { notify } = useToast();
  const { loadData } = useAppData();
  const [qty, setQty] = useState('');
  const [site, setSite] = useState(account.locations?.[0]?.id || '');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const points = qty ? redemptionPoints(rate, qty) : 0;
  const tooMany = points > (account.pointsBalance || 0);

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/redemptions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceCode: rate.code, serviceName: rate.name, quantity: Number(qty), locationId: site, organizationId: account.id })
      });
      const data = await res.json();
      if (!res.ok) notify(data.error || 'The redemption could not be sent.', 'danger');
      else { notify(`${rate.name} booked. Our team will confirm it.`); setQty(''); onDone(); loadData(); }
    } catch { notify('Cannot reach the server. Nothing was booked.', 'danger'); }
    setBusy(false); setConfirming(false);
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{rate.name}</h3>
        <Badge tone="rewards">{rate.points} pts / {rate.unit}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input type="number" min="1" inputMode="decimal" className={inputCls} placeholder={`How many ${rate.unit}`} value={qty} onChange={e => { setQty(e.target.value); setConfirming(false); }} disabled={locked} aria-label={`Quantity in ${rate.unit}`} />
        <select className={inputCls} value={site} onChange={e => setSite(e.target.value)} disabled={locked} aria-label="Site">
          {(account.locations || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="mt-3 flex flex-1 items-end justify-between gap-2">
        <span className={`text-xs font-semibold ${tooMany ? 'text-red-600' : 'text-slate-500'}`}>{qty ? `${points} pts${tooMany ? ' (not enough points)' : ''}` : ' '}</span>
        {locked ? <Badge tone="slate"><Lock className="h-3 w-3" />Locked</Badge> : confirming ? (
          <span className="flex gap-1">
            <Button variant="rewards" size="sm" onClick={send} disabled={busy}>{busy ? 'Sending…' : `Use ${points} pts`}</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
          </span>
        ) : (
          <Button variant="rewards" size="sm" disabled={!qty || Number(qty) <= 0 || tooMany || !site} onClick={() => setConfirming(true)}>Redeem</Button>
        )}
      </div>
    </div>
  );
}
