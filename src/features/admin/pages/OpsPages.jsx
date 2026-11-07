// W19 Reward redemption approvals, W20 Reports & analytics, W21 Hotline phone booking
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Gift, CheckCircle2, BarChart3, Clock, Building2, DollarSign, ClipboardList, PhoneCall, Download, Info, Siren } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Kpi, Button, Tabs, Badge, Field, Alert, EmptyState, StickyActions, InlineConfirm, inputCls, useToast, cx, useFieldErrors } from '@/shared/ui/index.jsx';
import { PhoneInput, AddressAutocomplete } from '@/shared/ui/inputs.jsx';
import { phoneError, personNameError, textError } from '@shared/validation.js';
import { formatDateTime, isCompleted } from '@/shared/ui/jobs.jsx';
import { fmtMoney } from '@/shared/ui/membership.jsx';

/* ------------------------------------------------------------------ Rewards queue */

export function RewardsQueuePage() {
  const { notify } = useToast();
  const { loadData } = useAppData();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'PENDING_APPROVAL';
  const setTab = (t) => setParams({ tab: t }, { replace: true });

  const load = async () => {
    try { const res = await fetch(`${API_BASE}/redemptions`); const d = await res.json(); if (res.ok && Array.isArray(d)) setItems(d); } catch { /* offline */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (r, status, extra = {}) => {
    try {
      const res = await fetch(`${API_BASE}/redemptions/${r.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...extra }) });
      const d = await res.json();
      if (!res.ok) return notify(d.error || 'The decision could not be saved.', 'danger');
      notify(status === 'APPROVED' ? `Booked: ${d.redemption?.calculatedPoints ?? 0} pts used${d.redemption?.balanceDue ? `, ${fmtMoney(d.redemption.balanceDue)} + GST invoiced` : ''}.` : status === 'CANCELLED' ? 'Booking cancelled. Points returned.' : 'Request declined.');
      load(); loadData();
    } catch { notify('Cannot reach the server. Nothing was changed.', 'danger'); }
  };

  const shown = items.filter(r => tab === 'all' || r.status === tab);
  const month = new Date().getMonth();
  const approvedThisMonth = items.filter(r => r.status === 'APPROVED' && new Date(r.updatedAt || r.createdAt).getMonth() === month);

  return (
    <Page fit title="Reward redemptions" subtitle="Quote the service and book it. Points (1 point = $1) are taken at booking.">
      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Waiting" value={items.filter(r => r.status === 'PENDING_APPROVAL').length} icon={Clock} tone="warning" to="?tab=PENDING_APPROVAL" title="Show redemptions waiting for your decision" />
        <Kpi label="Booked this month" value={approvedThisMonth.length} icon={CheckCircle2} tone="success" to="?tab=APPROVED" title="Show booked redemptions" />
        <Kpi label="Points used this month" value={approvedThisMonth.reduce((n, r) => n + (r.calculatedPoints || 0), 0)} icon={Gift} tone="rewards" className="col-span-2 md:col-span-1" to="?tab=APPROVED" title="Show booked redemptions" />
      </div>
      <Card title="Requests" icon={Gift} className="mt-4 fit:min-h-0 fit:flex-1" bodyClassName="fit:flex-1 fit:overflow-y-auto"
        actions={<Tabs value={tab} onChange={setTab} tabs={[{ key: 'PENDING_APPROVAL', label: 'To quote' }, { key: 'APPROVED', label: 'Booked' }, { key: 'REJECTED', label: 'Declined' }, { key: 'CANCELLED', label: 'Cancelled' }, { key: 'all', label: 'All' }]} />}>
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : shown.length === 0 ? <EmptyState title="Nothing here" /> : (
          <ul className="divide-y divide-slate-100">
            {shown.map(r => <RedemptionRow key={r.id} r={r} decide={decide} />)}
          </ul>
        )}
      </Card>
    </Page>
  );
}

const R_STATUS = { APPROVED: ['Booked', 'success'], REJECTED: ['Declined', 'danger'], CANCELLED: ['Cancelled', 'slate'] };

function RedemptionRow({ r, decide }) {
  const [quote, setQuote] = useState('');
  const [date, setDate] = useState('');
  const balance = r.organization?.pointsBalance ?? 0;
  const price = Number(quote) || 0;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-col gap-1 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{r.organization?.businessName} · {r.serviceName}</div>
          <div className="text-xs text-slate-500">{r.location?.name || 'site'}{r.notes ? ` · ${r.notes}` : ''} · {formatDateTime(r.createdAt)} · balance {balance} pts</div>
          {r.quoteAmount ? <div className="text-xs text-slate-600">Price {fmtMoney(r.quoteAmount)}{r.discountPercent ? ` less ${r.discountPercent}% loyalty` : ''} · {r.calculatedPoints} pts used{r.balanceDue ? ` · ${fmtMoney(r.balanceDue)} + GST invoiced` : ''}{r.scheduledFor ? ` · booked for ${new Date(r.scheduledFor).toLocaleDateString('en-AU')}` : ''}</div> : null}
        </div>
        {r.status !== 'PENDING_APPROVAL' && <Badge tone={R_STATUS[r.status]?.[1] || 'slate'}>{R_STATUS[r.status]?.[0] || r.status}</Badge>}
        {r.status === 'APPROVED' && <InlineConfirm label="Cancel booking" message="SACC cancels: the points go back to the member." confirmLabel="Cancel booking" onConfirm={() => decide(r, 'CANCELLED')} />}
      </div>
      {r.status === 'PENDING_APPROVAL' && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-2">
          <Field label="Price ex GST ($)"><input type="number" min="1" className={cx(inputCls, 'h-9 w-32')} value={quote} onChange={e => setQuote(e.target.value)} /></Field>
          <Field label="Booked for"><input type="date" className={cx(inputCls, 'h-9')} value={date} onChange={e => setDate(e.target.value)} /></Field>
          <span className="pb-2 text-xs text-slate-500">{price ? `Uses up to ${Math.min(balance, Math.floor(price))} pts (less any loyalty discount)` : 'Enter SACC\'s price'}</span>
          <span className="ml-auto flex gap-2 pb-0.5">
            <Button size="sm" variant="success" disabled={!price} onClick={() => decide(r, 'APPROVED', { quoteAmount: price, scheduledFor: date || undefined })} title="Book the service and take the points">Book</Button>
            <InlineConfirm label="Decline" title="Decline this request. No points are taken." message="Decline?" confirmLabel="Decline" onConfirm={() => decide(r, 'REJECTED')} />
          </span>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ Reports */

const RANGES = { 30: 'Last 30 days', 90: 'Last 90 days', 365: 'Last 12 months' };

export function ReportsPage() {
  const { jobs } = useAppData();
  const [summary, setSummary] = useState(null);
  const [days, setDays] = useState('90');
  useEffect(() => { fetch(`${API_BASE}/analytics/summary`).then(r => r.ok ? r.json() : null).then(setSummary).catch(() => {}); }, []);

  const since = Date.now() - Number(days) * 86400000;
  const inRange = jobs.filter(j => new Date(j.submittedAt || j.createdAt || 0).getTime() >= since);

  const weekly = useMemo(() => {
    const weeks = Math.min(12, Math.ceil(Number(days) / 7));
    const buckets = Array.from({ length: weeks }, (_, i) => ({ label: '', count: 0, start: Date.now() - (weeks - i) * 7 * 86400000 }));
    buckets.forEach(b => { b.label = new Date(b.start).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); });
    for (const j of inRange) {
      const t = new Date(j.submittedAt || j.createdAt || 0).getTime();
      const idx = buckets.findIndex((b, i) => t >= b.start && (i === buckets.length - 1 || t < buckets[i + 1].start));
      if (idx >= 0) buckets[idx].count++;
    }
    return buckets;
  }, [inRange, days]);
  const max = Math.max(1, ...weekly.map(w => w.count));

  const byType = useMemo(() => {
    const m = {};
    inRange.forEach(j => { m[j.category] = (m[j.category] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [inRange]);
  const topCustomers = useMemo(() => {
    const m = {};
    inRange.forEach(j => { m[j.customerName] = (m[j.customerName] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [inRange]);

  const exportCsv = () => {
    const rows = [['Job', 'Customer', 'Site', 'Category', 'Status', 'Technician', 'Submitted']]
      .concat(inRange.map(j => [j.jobNumber, j.customerName, j.locationName, j.category, j.status, j.technicianName, j.submittedAt]));
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `sa-emergency-jobs-${days}d.csv`;
    a.click();
  };

  return (
    <Page fit title="Reports & analytics" subtitle="Response performance, demand and revenue"
      actions={<>
        <select className={cx(inputCls, 'h-10 w-auto py-2')} value={days} onChange={e => setDays(e.target.value)} aria-label="Date range">
          {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button title="Download this report as a spreadsheet (CSV)" variant="secondary" icon={Download} onClick={exportCsv}>Export CSV</Button>
      </>}>
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="SLA met (2–4 h)" value={summary?.slaResponseSuccessRate ?? '—'} icon={CheckCircle2} tone="success" to="/admin/dispatch?status=done" title="Show the completed jobs behind this figure" />
        <Kpi label="Avg. attendance" value={summary?.avgAttendanceTimeMinutes != null ? `${summary.avgAttendanceTimeMinutes} min` : '—'} icon={Clock} tone="brand" to="/admin/dispatch?status=done" title="Show the completed jobs behind this figure" />
        <Kpi label="Active customers" value={summary ? `${summary.activeCustomers} / ${summary.totalCustomers}` : '—'} icon={Building2} tone="slate" to="/admin/customers" title="Open the customer list" />
        <Kpi label="Revenue this month" value={summary ? `$${Number(summary.totalRevenueMonth || 0).toLocaleString()}` : '—'} icon={DollarSign} tone="rewards" to="/admin/customers" title="Open the customers and their plans" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr] fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <Card title={`Call-outs per week (${inRange.length} in range)`} icon={BarChart3} className="fit:min-h-0" bodyClassName="flex-1 flex flex-col">
          <div className="flex min-h-[180px] flex-1 items-end gap-1.5 border-b border-slate-200 pb-1" role="img" aria-label="Bar chart of call-outs per week">
            {weekly.map((w, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold text-slate-500">{w.count || ''}</span>
                <div className="w-full rounded-t-md bg-brand" style={{ height: `${(w.count / max) * 100}%`, minHeight: w.count ? 4 : 0 }} title={`${w.label}: ${w.count}`} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">{weekly.map((w, i) => <span key={i} className="flex-1 truncate text-center text-[10px] text-slate-400">{i % 2 === 0 ? w.label : ''}</span>)}</div>
        </Card>
        <div className="flex min-h-0 flex-col gap-4">
          <Card title="By incident type" icon={ClipboardList} className="fit:min-h-0 fit:flex-1" bodyClassName="fit:overflow-y-auto">
            {byType.length === 0 ? <p className="text-sm text-slate-500">No jobs in this range.</p> : (
              <ul className="space-y-2">
                {byType.map(([k, v]) => (
                  <li key={k}>
                    <div className="flex justify-between text-xs"><span className="font-semibold text-slate-700">{k}</span><span className="text-slate-500">{v}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${(v / inRange.length) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Top customers" icon={Building2} className="shrink-0">
            {topCustomers.length === 0 ? <p className="text-sm text-slate-500">No jobs in this range.</p> : (
              <ol className="space-y-1 text-sm">{topCustomers.map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span className="truncate text-slate-700">{k}</span><span className="font-semibold text-slate-900">{v}</span></li>)}</ol>
            )}
            <p className="mt-3 text-xs text-slate-500">{inRange.filter(j => isCompleted(j.status)).length} completed in range.</p>
          </Card>
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ Hotline */

export function HotlinePage() {
  const { customers, config, upsertJob } = useAppData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState(customers[0]?.id || '');
  const org = customers.find(c => c.id === orgId);
  const [siteId, setSiteId] = useState(org?.locations?.[0]?.id || '');
  const site = org?.locations?.find(l => l.id === siteId) || org?.locations?.[0];
  const [callerName, setCallerName] = useState(org?.primaryContactName || '');
  const [callerPhone, setCallerPhone] = useState(org?.phoneNumber || '');
  const [category, setCategory] = useState('Toilet overflow');
  const [address, setAddress] = useState(site?.address || '');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { errors, check, clear, setErrors } = useFieldErrors();
  const edit = (setter, field) => (v) => { setter(v); clear(field); };
  const plan = (config.membershipPlans || []).find(p => p.id === org?.membershipPlan);
  const siteInfo = org?.membership?.sites?.find(x => x.id === site?.id);
  const left = siteInfo ? siteInfo.remaining : org?.membership ? org.membership.remaining : null;

  const pickOrg = (id) => {
    setOrgId(id); setErrors({});
    const o = customers.find(c => c.id === id);
    setCallerName(o?.primaryContactName || ''); setCallerPhone(o?.phoneNumber || '');
    setSiteId(o?.locations?.[0]?.id || ''); setAddress(o?.locations?.[0]?.address || '');
  };
  const pickSite = (id) => { setSiteId(id); setAddress(org?.locations?.find(l => l.id === id)?.address || ''); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const ok = check({
      callerName: v => personNameError(v.callerName, { label: 'Caller name' }),
      callerPhone: v => phoneError(v.callerPhone),
      address: v => textError(v.address, { label: 'Site address', min: 4 }),
      description: v => (String(v.description).trim().length < 5 ? 'Describe what happened (at least 5 characters).' : '')
    }, { callerName, callerPhone, address, description });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: org?.id, locationId: site?.id || null, customerName: org?.businessName || 'Hotline caller',
          locationName: site?.name || 'Hotline site', address, category,
          description: `[HOTLINE ORDER] Caller: ${callerName} (${callerPhone}) • ${description}`,
          onsiteContact: callerName, onsitePhone: callerPhone, accessInstructions: site?.accessInstructions || 'Operator recorded phone request', photos: []
        })
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        // The API names its own fields; show each message under the matching box here
        const f = data.fields || {};
        const mapped = { callerName: f.onsiteContact, callerPhone: f.onsitePhone, address: f.address, description: f.description };
        if (Object.values(mapped).some(Boolean)) setErrors(mapped); else setError(data.error || 'The booking could not be created.');
        setBusy(false); return;
      }
      upsertJob(data);
      notify(`Job ${data.jobNumber} created. Assign a technician now.`);
      navigate(`/admin/jobs/${data.id}`);
    } catch { setError('Cannot reach the server. The booking was not created.'); setBusy(false); }
  };

  return (
    <Page title="Hotline phone booking" subtitle="Log an emergency while the customer is on the phone" breadcrumb={[{ label: 'Dispatch', to: '/admin/dispatch' }, { label: 'Hotline booking' }]} backTo={false}>
      <form onSubmit={submit} noValidate className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Alert>{error}</Alert>
          <Card title="Customer and site" icon={Building2}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Customer" required>
                <select className={inputCls} value={orgId} onChange={e => pickOrg(e.target.value)}>{customers.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}</select>
              </Field>
              <Field label="Site">
                <select className={inputCls} value={siteId} onChange={e => pickSite(e.target.value)}>{(org?.locations || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              </Field>
              <Field label="Site address" required className="md:col-span-2" as="div" error={errors.address}><AddressAutocomplete value={address} onChange={edit(setAddress, 'address')} onSelect={a => edit(setAddress, 'address')(a.address || a.street)} /></Field>
            </div>
          </Card>
          <Card title="Caller" icon={PhoneCall}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Caller name" required error={errors.callerName}><input className={inputCls} value={callerName} onChange={e => edit(setCallerName, 'callerName')(e.target.value)} /></Field>
              <Field label="Caller phone" required error={errors.callerPhone}><PhoneInput value={callerPhone} onChange={edit(setCallerPhone, 'callerPhone')} /></Field>
            </div>
          </Card>
          <Card title="Incident" icon={Siren}>
            <div className="grid gap-3">
              <Field label="Incident type" required>
                <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>{(config.incidentCategories || []).map(c => <option key={c}>{c}</option>)}</select>
              </Field>
              <Field label="What happened" required error={errors.description}><textarea rows={3} className={inputCls} value={description} onChange={e => edit(setDescription, 'description')(e.target.value)} /></Field>
            </div>
          </Card>
          <StickyActions className="xl:hidden"><Button type="submit" variant="emergency" disabled={busy} title="Create the emergency job, then assign a technician">{busy ? 'Creating…' : 'Create job'}</Button></StickyActions>
        </div>
        <aside className="space-y-4">
          <Card title="Customer snapshot" icon={Info}>
            {org ? (
              <dl className="space-y-2 text-sm">
                <div className="font-semibold text-slate-900">{org.businessName}</div>
                <div className="text-slate-600">{plan?.name} plan · {org.phoneNumber}</div>
                <Badge tone={left ? 'success' : 'warning'}>{left === null ? '' : left ? `${left} call-out(s) left` : `No included call-outs left at this site ($${config.additionalCalloutFee} + GST additional call-out)`}</Badge>
              </dl>
            ) : <p className="text-sm text-slate-500">Choose a customer.</p>}
          </Card>
          <Button type="submit" variant="emergency" size="lg" block disabled={busy} className="hidden xl:inline-flex" title="Create the emergency job, then assign a technician">{busy ? 'Creating…' : 'Create job & go to dispatch'}</Button>
        </aside>
      </form>
    </Page>
  );
}
