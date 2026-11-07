// W17 Customers (+ new customer page), W18 Technicians (+ add / edit pages).
// Replaces the Customers and Technicians tabs, AddTechnicianModal, EditTechnicianModal and the temp-password alert().
import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, Plus, Search, Eye, History, MapPin, ClipboardList, Users, Copy, CheckCircle2, Save, Trash2, Edit3, Phone, Star, UploadCloud, KeyRound } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Kpi, Button, Tabs, Badge, InfoRow, Field, Alert, EmptyState, StickyActions, InlineConfirm, inputCls, useToast, cx, useFieldErrors } from '@/shared/ui/index.jsx';
import { PhoneInput } from '@/shared/ui/inputs.jsx';
import { phoneError, emailError, personNameError, numberError, textError, abnError } from '@shared/validation.js';
import { SitesSection } from '@/features/customer/pages/AccountPage.jsx';
import { JobList } from '@/features/customer/components/JobList.jsx';
import { Avatar, TechStatusBadge } from './DispatchPages.jsx';
import { fmtDate, fmtMoney, LoyaltyBadge } from '@/shared/ui/membership.jsx';

/* ------------------------------------------------------------------ Customers */

// These pages serve the admin desk (/admin/...) and the config account (/settings/...).
// Config can view and edit customers and technicians; adding, deleting and dispatch stay with admin.
export function useStaffArea() {
  const { currentUser } = useAppData();
  const { pathname } = useLocation();
  const base = pathname.startsWith('/settings') ? '/settings' : '/admin';
  const isAdmin = currentUser?.role === 'admin';
  // Config can't open admin job pages, so a job opens its change history instead
  const jobLink = (j) => (isAdmin ? `/admin/jobs/${j.id}` : `/settings/activity?entityType=EmergencyRequest&entityId=${j.id}`);
  const historyLink = (type, id) => `/settings/activity?entityType=${type}&entityId=${id}`;
  return { base, isAdmin, jobLink, historyLink };
}

export function CustomersPage() {
  const { customers, config } = useAppData();
  const navigate = useNavigate();
  const { base, isAdmin } = useStaffArea();
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const shown = customers.filter(c =>
    (!plan || c.membershipPlan === plan) &&
    (!q || `${c.businessName} ${c.abn} ${c.primaryContactName} ${c.email}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <Page fit title="Customers" subtitle={`${customers.length} business accounts`}
      actions={isAdmin && <Button title="Sign up a new customer company" to="/admin/customers/new" icon={Plus}>Register company</Button>}>
      <div className="mb-3 grid shrink-0 gap-2 sm:grid-cols-[1fr_200px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={cx(inputCls, 'pl-9')} placeholder="Search name, ABN, contact or email" value={q} onChange={e => setQ(e.target.value)} aria-label="Search customers" />
        </label>
        <select className={inputCls} value={plan} onChange={e => setPlan(e.target.value)} aria-label="Filter by plan">
          <option value="">All plans</option>
          {(config.membershipPlans || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <Card className="fit:min-h-0 fit:flex-1" bodyClassName="fit:flex-1 fit:overflow-y-auto">
        {shown.length === 0 ? <EmptyState title="No customers match" /> : (
          <>
            <table className="hidden w-full text-left text-sm md:table border-separate border-spacing-0">
              <thead className="sticky top-0 z-10"><tr className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="sticky top-0 z-10 bg-white py-2.5 pr-3 border-b border-slate-200">Business</th>
                <th className="sticky top-0 z-10 bg-white py-2.5 pr-3 border-b border-slate-200">Contact</th>
                <th className="sticky top-0 z-10 bg-white py-2.5 pr-3 border-b border-slate-200">Plan</th>
                <th className="hidden py-2.5 pr-3 lg:table-cell sticky top-0 z-10 bg-white border-b border-slate-200">Call-outs used</th>
                <th className="hidden py-2.5 pr-3 lg:table-cell sticky top-0 z-10 bg-white border-b border-slate-200">Points</th>
                <th className="sticky top-0 z-10 bg-white py-2.5 pr-3 border-b border-slate-200">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map(c => (
                  <tr key={c.id} title="Open this customer to see and edit their details" onClick={() => navigate(`${base}/customers/${c.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="py-3 pr-3"><div className="font-semibold text-slate-900">{c.businessName}</div><div className="text-xs text-slate-500">ABN {c.abn} · {(c.locations || []).length} site(s)</div></td>
                    <td className="py-3 pr-3"><div className="text-slate-800">{c.primaryContactName || c.primaryContact}</div><div className="text-xs text-slate-500">{c.phoneNumber || c.phone}</div></td>
                    <td className="py-3 pr-3 font-semibold capitalize text-brand-dark">{c.membershipPlan}</td>
                    <td className="hidden py-3 pr-3 lg:table-cell">{c.membership ? `${c.membership.used} / ${c.membership.included}` : c.calloutsUsed ?? 0}</td>
                    <td className="hidden py-3 pr-3 font-semibold text-purple-700 lg:table-cell">{c.pointsBalance ?? 0}</td>
                    <td className="py-3 pr-3"><MemberStatus c={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-2 md:hidden">
              {shown.map(c => (
                <li key={c.id}><Link to={`${base}/customers/${c.id}`} title="Open this customer" className="block rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{c.businessName}</span><Badge tone="brand" className="capitalize">{c.membershipPlan}</Badge></div>
                  <div className="mt-0.5 text-xs text-slate-500">{c.primaryContactName} · {c.phoneNumber}</div>
                </Link></li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </Page>
  );
}

export function CustomerDetailPage() {
  const { customerId } = useParams();
  const { customers, jobs, config, setSelectedCustomerId } = useAppData();
  const navigate = useNavigate();
  const { base, isAdmin, jobLink, historyLink } = useStaffArea();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const setTab = (t) => setParams({ tab: t }, { replace: true });
  const c = customers.find(x => x.id === customerId);
  if (!c) return <Page breadcrumb={[{ label: 'Customers', to: `${base}/customers` }, { label: 'Customer' }]}><Card><EmptyState title="Customer not found" /></Card></Page>;
  const plan = (config.membershipPlans || []).find(p => p.id === c.membershipPlan);
  const theirJobs = jobs.filter(j => j.organizationId === c.id);

  return (
    <Page title={c.businessName} subtitle={`ABN ${c.abn}`} breadcrumb={[{ label: 'Customers', to: `${base}/customers` }, { label: c.businessName }]}
      actions={<>
        <Button variant="secondary" icon={History} to={historyLink('Organization', c.id)} title="See every change made to this customer: who, when and what">Activity history</Button>
        {isAdmin && <Button variant="secondary" icon={Eye} title="See the app exactly as this customer sees it" onClick={() => { setSelectedCustomerId(c.id); navigate('/app'); }}>Open customer view</Button>}
      </>}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Plan" value={plan?.name || c.membershipPlan} sub={c.membership ? `${fmtMoney(c.membership.fee.monthly)} + GST/mo${c.membership.fee.discountPercent ? ` (${c.membership.fee.discountPercent}% multi-site)` : ''}` : ''} to="?tab=overview" title="Show the account details" />
        <Kpi label="Call-outs this month" value={`${c.membership?.used ?? 0} / ${c.membership?.included ?? '–'}`} sub={c.membership?.bonusCallouts ? `+${c.membership.bonusCallouts} Gold bonus` : `resets in ${c.membership?.daysUntilReset ?? '–'} days`} tone="success" to="?tab=sites" title="Show call-outs per site" />
        <Kpi label="Points" value={c.pointsBalance ?? 0} tone="rewards" to={isAdmin ? '/admin/rewards?tab=all' : historyLink('Organization', c.id)} title={isAdmin ? 'Open reward redemptions' : 'See the changes made to this customer'} />
        <Kpi label="Jobs" value={theirJobs.length} tone="slate" to="?tab=jobs" title="Show this customer's jobs" />
      </div>
      <Tabs className="mt-4" value={tab} onChange={setTab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'sites', label: 'Sites', count: (c.locations || []).length }, { key: 'jobs', label: 'Jobs', count: theirJobs.length }]} />
      <div className="mt-3">
        {tab === 'overview' && <><MembershipAdminCard customer={c} canEdit={isAdmin} /><div className="mt-4"><CustomerEditForm key={c.id} customer={c} /></div></>}
        {tab === 'sites' && <><SiteScheduleCard customer={c} /><div className="mt-4"><SitesSection account={c} allowAdd={isAdmin} /></div></>}
        {tab === 'jobs' && <Card title="Jobs" icon={ClipboardList}><JobList jobs={theirJobs} linkTo={jobLink} /></Card>}
      </div>
    </Page>
  );
}

// Edit and save a customer's details and plan (admin and config)
function CustomerEditForm({ customer: c }) {
  const { config, upsertCustomer } = useAppData();
  const { notify } = useToast();
  const initial = {
    businessName: c.businessName || '', abn: c.abn || '', primaryContactName: c.primaryContactName || c.primaryContact || '',
    phoneNumber: c.phoneNumber || c.phone || '', email: c.email || '', membershipPlan: c.membershipPlan || '', billingFrequency: c.billingFrequency || 'MONTHLY'
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { errors, check, clear, fromServer } = useFieldErrors();
  const setVal = (k) => (v) => { setForm(f => ({ ...f, [k]: v })); clear(k); };
  const set = (k) => (e) => setVal(k)(e.target.value);
  const dirty = Object.keys(initial).some(k => String(initial[k]) !== String(form[k]));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const ok = check({
      businessName: v => textError(v.businessName, { label: 'Company name' }),
      abn: v => abnError(v.abn, { required: true }),
      primaryContactName: v => personNameError(v.primaryContactName, { label: 'Primary contact' }),
      phoneNumber: v => phoneError(v.phoneNumber),
      email: v => emailError(v.email)
    }, form);
    if (!ok) return;
    setSaving(true);
    try {
      const { membershipPlan, ...profile } = form;
      const res = await fetch(`${API_BASE}/customers/${c.id}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
      const data = await res.json();
      if (!res.ok || !data.customer) { if (!fromServer(data)) setError(data.error || 'The customer could not be saved.'); setSaving(false); return; }
      let saved = data.customer;
      if (membershipPlan !== c.membershipPlan) {
        const r2 = await fetch(`${API_BASE}/customers/${c.id}/plan`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ membershipPlan }) });
        const d2 = await r2.json();
        if (!r2.ok || !d2.customer) { setError(d2.error || 'The details were saved, but the plan could not be changed.'); upsertCustomer(saved); setSaving(false); return; }
        saved = d2.customer;
      }
      upsertCustomer(saved);
      notify(`${saved.businessName} saved.`);
    } catch { setError('Cannot reach the server. Nothing was saved.'); }
    setSaving(false);
  };

  return (
    <form onSubmit={save} noValidate>
      <Card title="Account details" icon={Building2}>
        <Alert>{error}</Alert>
        <div className="mt-1 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Company name" required error={errors.businessName} className="md:col-span-2"><input className={inputCls} value={form.businessName} onChange={set('businessName')} /></Field>
          <Field label="ABN" required error={errors.abn}><input className={inputCls} inputMode="numeric" maxLength={14} value={form.abn} onChange={e => setVal('abn')(e.target.value.replace(/[^\d\s]/g, ''))} /></Field>
          <Field label="Primary contact" required error={errors.primaryContactName}><input className={inputCls} value={form.primaryContactName} onChange={set('primaryContactName')} /></Field>
          <Field label="Phone" required error={errors.phoneNumber}><PhoneInput value={form.phoneNumber} onChange={setVal('phoneNumber')} /></Field>
          <Field label="Email (login)" required error={errors.email}><input type="email" className={inputCls} value={form.email} onChange={set('email')} /></Field>
          <Field label="Membership plan" hint="Upgrades apply now (pro-rata); downgrades from the next billing period">
            <select className={inputCls} value={form.membershipPlan} onChange={set('membershipPlan')}>
              {(config.membershipPlans || []).map(p => <option key={p.id} value={p.id}>{p.name} (${p.price} + GST/month)</option>)}
            </select>
          </Field>
          <Field label="Billing">
            <select className={inputCls} value={form.billingFrequency} onChange={set('billingFrequency')}>
              <option value="MONTHLY">Monthly direct debit</option><option value="ANNUAL">Annually in advance</option>
            </select>
          </Field>
        </div>
        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <InfoRow label="Payment method">{c.paymentMethod}</InfoRow>
          <InfoRow label="Membership"><MemberStatus c={c} /></InfoRow>
          <InfoRow label="Member for">{c.membership?.monthsActive ?? 0} months</InfoRow>
        </dl>
      </Card>
      <StickyActions>
        {dirty && <span className="mr-auto text-xs font-semibold text-amber-700">Unsaved changes</span>}
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => setForm(initial)} title="Undo the changes you have not saved">Discard</Button>
        <Button type="submit" icon={Save} disabled={!dirty || saving} title="Save this customer's details. The change is recorded in the activity log.">{saving ? 'Saving…' : 'Save changes'}</Button>
      </StickyActions>
    </form>
  );
}

/* ------------------------------------------------------------------ Technicians */

export function TechniciansPage() {
  const { technicians } = useAppData();
  const { base, isAdmin } = useStaffArea();
  const [tab, setTab] = useState('all');
  const shown = technicians.filter(t => tab === 'all' || t.status === tab);
  const count = (s) => technicians.filter(t => t.status === s).length;
  return (
    <Page title="Technicians" subtitle={`${technicians.length} field technicians · status worked out live from their jobs`} actions={isAdmin && <Button to="/admin/technicians/new" icon={Plus} title="Add a technician and create their login">Add technician</Button>}>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'all', label: 'All', count: technicians.length }, { key: 'AVAILABLE', label: 'Available', count: count('AVAILABLE') },
        { key: 'ON_SITE', label: 'On a job', count: count('ON_SITE') }, { key: 'OFF_DUTY', label: 'Off duty', count: count('OFF_DUTY') }
      ]} />
      {shown.length === 0 ? <Card className="mt-4"><EmptyState title="Nobody here" /></Card> : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map(t => (
            <li key={t.id}>
              <Link to={`${base}/technicians/${t.id}`} title={`Open ${t.name} to edit their details`} className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300">
                <div className="flex items-center gap-3">
                  <Avatar tech={t} size="h-12 w-12" />
                  <div className="min-w-0 flex-1"><div className="truncate font-bold text-slate-900">{t.name}</div><div className="truncate text-xs text-slate-500">{t.email || ''}</div></div>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{t.phone}</span>
                  <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" />{t.rating || 5.0}</span>
                </div>
                <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center">
                  <div><dt className="text-[10px] font-bold uppercase text-slate-400">Working</dt><dd className="text-sm font-bold text-slate-900">{t.workingJobs ?? 0}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase text-slate-400">Waiting</dt><dd className="text-sm font-bold text-slate-900">{t.waitingJobs ?? 0}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase text-slate-400">Done</dt><dd className="text-sm font-bold text-slate-900">{t.completedJobs ?? 0}</dd></div>
                </dl>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2"><TechStatusBadge status={t.status} />{t.activeJobId && <span className="truncate font-mono text-[11px] font-bold text-brand">{t.activeJobId}</span>}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand"><Edit3 className="h-3 w-3" />Edit</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

export function TechnicianFormPage() {
  const { techId } = useParams();
  const { technicians, setTechnicians, reloadTechnicians, jobs } = useAppData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const existing = techId ? technicians.find(t => t.id === techId) : null;
  const { base, isAdmin, jobLink, historyLink } = useStaffArea();
  const [form, setForm] = useState(() => ({
    name: existing?.name || '', phone: existing?.phone || '', email: existing?.email || '',
    status: existing?.dutyStatus === 'OFF_DUTY' || existing?.status === 'OFF_DUTY' ? 'OFF_DUTY' : 'AVAILABLE', rating: existing?.rating || 5.0, avatar: existing?.avatar || ''
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // { email, tempPassword } shown once
  const [copied, setCopied] = useState(false);
  const { errors, check, clear, fromServer } = useFieldErrors();
  const theirJobs = useMemo(() => existing ? jobs.filter(j => j.technicianName === existing.name) : [], [jobs, existing]);

  if (techId && !existing) return <Page breadcrumb={[{ label: 'Technicians', to: `${base}/technicians` }, { label: 'Technician' }]}><Card><EmptyState title="Technician not found" /></Card></Page>;

  const setVal = (k) => (v) => { setForm(f => ({ ...f, [k]: v })); clear(k); };
  const set = (k) => (e) => setVal(k)(e.target.value);
  const onPhoto = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onloadend = () => setForm(x => ({ ...x, avatar: r.result })); r.readAsDataURL(f); };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const ok = check({
      name: v => personNameError(v.name, { label: 'Full name' }),
      phone: v => phoneError(v.phone),
      email: v => (existing ? '' : emailError(v.email, { required: false })),
      rating: v => (existing ? numberError(v.rating, { label: 'Rating', min: 1, max: 5 }) : '')
    }, form);
    if (!ok) return;
    setSaving(true);
    try {
      const body = existing ? { ...existing, ...form, rating: parseFloat(form.rating) || 5 } : { name: form.name, phone: form.phone, email: form.email || undefined, status: form.status, avatar: form.avatar };
      const res = await fetch(existing ? `${API_BASE}/technicians/${existing.id}` : `${API_BASE}/technicians`, {
        method: existing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const saved = await res.json();
      if (!res.ok || !saved.id) { if (!fromServer(saved)) setError(saved.error || 'The technician could not be saved.'); setSaving(false); return; }
      const { tempPassword, ...tech } = saved;
      if (existing) {
        await reloadTechnicians();
        notify('Technician saved.');
        navigate(`${base}/technicians`);
      } else {
        await reloadTechnicians();
        setCreated({ name: tech.name, email: tech.email, tempPassword });
      }
    } catch { setError('Cannot reach the server. Nothing was saved.'); }
    setSaving(false);
  };

  const remove = async () => {
    try {
      const res = await fetch(`${API_BASE}/technicians/${existing.id}`, { method: 'DELETE' });
      if (res.ok) { setTechnicians(technicians.filter(t => t.id !== existing.id)); notify('Technician removed.'); navigate(`${base}/technicians`); }
      else { const d = await res.json().catch(() => ({})); notify(d.error || 'The technician could not be removed.', 'danger'); }
    } catch { notify('Cannot reach the server. Nothing was removed.', 'danger'); }
  };

  if (created) {
    return (
      <Page title="Technician added" breadcrumb={[{ label: 'Technicians', to: `${base}/technicians` }, { label: 'New' }]} width="narrow">
        <Card tone="success" title={`${created.name} can now sign in`} icon={CheckCircle2}>
          <p className="text-sm text-emerald-900">Give these login details to the technician. The temporary password is shown only once; they can change it in their profile.</p>
          <dl className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-white p-4 sm:grid-cols-2">
            <InfoRow label="Login email">{created.email}</InfoRow>
            <InfoRow label="Temporary password"><span className="font-mono">{created.tempPassword || '(set by you)'}</span></InfoRow>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button title="Copy the login email and temporary password" icon={copied ? CheckCircle2 : Copy} onClick={async () => { try { await navigator.clipboard.writeText(`Login: ${created.email}\nTemporary password: ${created.tempPassword}`); setCopied(true); } catch { /* clipboard blocked */ } }}>{copied ? 'Copied' : 'Copy details'}</Button>
            <Button title="Go back to the technician list" variant="secondary" to={`${base}/technicians`}>Back to technicians</Button>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page title={existing ? existing.name : 'Add technician'} subtitle={existing ? existing.email : 'A login is created and a temporary password shown once'}
      breadcrumb={[{ label: 'Technicians', to: `${base}/technicians` }, { label: existing ? existing.name : 'New' }]} width="medium">
      <form onSubmit={save} noValidate className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar tech={{ ...form, name: form.name || '?' }} size="h-24 w-24" />
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <UploadCloud className="h-3.5 w-3.5" />Photo<input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
          </div>
        </Card>
        <div className="space-y-4">
          <Alert>{error}</Alert>
          <Card title="Details" icon={Users}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Full name" required error={errors.name}><input className={inputCls} value={form.name} onChange={set('name')} placeholder="e.g. Jason Blake" /></Field>
              <Field label="Mobile phone" required error={errors.phone}><PhoneInput value={form.phone} onChange={setVal('phone')} placeholder="0499 111 222" /></Field>
              {!existing && <Field label="Login email" hint="Leave blank to create one automatically" error={errors.email}><input type="email" className={inputCls} value={form.email} onChange={set('email')} /></Field>}
              <Field label="Duty" hint="“On a job” is set automatically from the technician's jobs">
                <select className={inputCls} value={form.status} onChange={set('status')}>
                  <option value="AVAILABLE">On duty</option><option value="OFF_DUTY">Off duty</option>
                </select>
              </Field>
              {existing && <Field label="Rating (1–5)" error={errors.rating}><input type="number" min="1" max="5" step="0.1" className={inputCls} value={form.rating} onChange={set('rating')} /></Field>}
            </div>
          </Card>
          {existing && (
            <Card title={`Jobs (${theirJobs.length})`} icon={ClipboardList}>
              <JobList jobs={theirJobs} linkTo={jobLink} compact emptyTitle="No jobs yet" />
            </Card>
          )}
          <StickyActions>
            {existing && <Button variant="ghost" icon={History} to={historyLink('Technician', existing.id)} className="mr-auto" title="See every change made to this technician">History</Button>}
            {existing && isAdmin && <span><InlineConfirm label="Remove" title="Remove this technician and their login" icon={Trash2} message="Remove this technician?" confirmLabel="Remove" onConfirm={remove} /></span>}
            <Button variant="ghost" to={`${base}/technicians`} title="Go back to the technician list without saving">Cancel</Button>
            <Button type="submit" icon={existing ? Save : KeyRound} disabled={saving} title={existing ? 'Save the changes to this technician' : 'Add the technician and create their login'}>{saving ? 'Saving…' : existing ? 'Save changes' : 'Add & create login'}</Button>
          </StickyActions>
        </div>
      </form>
    </Page>
  );
}

function MemberStatus({ c }) {
  if (c.subscriptionStatus === 'CANCELLED') return <Badge tone="danger">Cancelled</Badge>;
  if (c.subscriptionStatus === 'SUSPENDED') return <Badge tone="danger">Suspended</Badge>;
  if (c.paymentNoticeAt) return <Badge tone="warning">Payment failed</Badge>;
  if (c.membership?.inWaitingPeriod) return <Badge tone="indigo">Waiting period</Badge>;
  return <Badge tone="success">Active</Badge>;
}

// Membership Schedule and billing (Agreement cl. 3, 4, 5, 15) for the admin desk
function MembershipAdminCard({ customer: c, canEdit }) {
  const { upsertCustomer } = useAppData();
  const { notify } = useToast();
  const m = c.membership || {};
  const payment = async (failed) => {
    try {
      const res = await fetch(`${API_BASE}/customers/${c.id}/payment-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ failed }) });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Not saved.', 'danger'); return; }
      upsertCustomer(data);
      notify(failed ? 'Failed payment recorded. The member is suspended after 7 days if unpaid.' : 'Payment recorded. The membership is active.');
    } catch { notify('Cannot reach the server.', 'danger'); }
  };
  return (
    <Card title="Membership and billing" icon={ClipboardList} actions={<LoyaltyBadge level={m.loyaltyLevel} />}>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoRow label="Membership number">{c.membershipNumber}</InfoRow>
        <InfoRow label="Activated">{fmtDate(m.activationDate)}</InfoRow>
        <InfoRow label="Waiting period">{m.inWaitingPeriod ? `Until ${fmtDate(m.waitingPeriodEnds)}` : 'Finished'}</InfoRow>
        <InfoRow label="Minimum term ends">{fmtDate(m.termEnds)}</InfoRow>
        <InfoRow label="Billing">{m.billingFrequency === 'ANNUAL' ? 'Annually' : 'Monthly'}: {fmtMoney(m.periodFee)} + GST</InfoRow>
        <InfoRow label="Next billing">{fmtDate(m.nextBillingDate)}</InfoRow>
        <InfoRow label="Rates locked until">{fmtDate(m.ratesLockedUntil)}</InfoRow>
        <InfoRow label="Referral code">{c.referralCode}</InfoRow>
        {m.pendingPlan && <InfoRow label="Scheduled change">{m.pendingPlan} from {fmtDate(m.pendingPlanFrom)}</InfoRow>}
        {c.paymentNoticeAt && <InfoRow label="Payment failed on">{fmtDate(c.paymentNoticeAt)}</InfoRow>}
        {c.cancellationReview && <InfoRow label="Review">Unpaid over 30 days: review for cancellation</InfoRow>}
      </dl>
      {canEdit && c.subscriptionStatus !== 'CANCELLED' && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {c.paymentNoticeAt || c.subscriptionStatus === 'SUSPENDED'
            ? <Button size="sm" variant="success" onClick={() => payment(false)} title="The overdue fee has been paid">Record payment received</Button>
            : <InlineConfirm label="Record failed payment" message="Starts the 7-day notice before suspension (cl. 4.4)." confirmLabel="Record" onConfirm={() => payment(true)} />}
        </div>
      )}
    </Card>
  );
}

// Per-site plan, call-outs and outside-metro approval (cl. 17, 18). Only SACC staff change these.
function SiteScheduleCard({ customer: c }) {
  const { config, upsertCustomer } = useAppData();
  const { notify } = useToast();
  const [km, setKm] = useState({});
  const sites = c.membership?.sites || [];
  const saveSite = async (id, body) => {
    try {
      const res = await fetch(`${API_BASE}/locations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Not saved.', 'danger'); return; }
      const r2 = await fetch(`${API_BASE}/customers/${c.id}`);
      if (r2.ok) upsertCustomer(await r2.json());
      notify('Site saved.');
    } catch { notify('Cannot reach the server.', 'danger'); }
  };
  if (!sites.length) return null;
  return (
    <Card title="Membership Schedule by site" icon={MapPin}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1 pr-3">Site</th><th className="pr-3">Plan</th><th className="pr-3">Call-outs</th><th className="pr-3">Area</th><th>Travel (km each way)</th></tr></thead>
          <tbody>
            {sites.map(s => {
              const loc = (c.locations || []).find(l => l.id === s.id) || {};
              const outside = s.serviceArea && s.serviceArea !== 'METRO';
              return (
                <tr key={s.id} className="border-t border-slate-100 align-middle">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{s.name}</td>
                  <td className="pr-3">
                    <select className={cx(inputCls, 'h-9 py-0')} value={loc.membershipPlan || ''} onChange={e => saveSite(s.id, { membershipPlan: e.target.value })}>
                      <option value="">Account plan</option>
                      {(config.membershipPlans || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="pr-3 tabular-nums">{s.used} / {s.included}</td>
                  <td className="pr-3">
                    {outside ? (
                      <label className="flex items-center gap-1.5 whitespace-nowrap">
                        <input type="checkbox" checked={Boolean(s.areaApproved)} onChange={e => saveSite(s.id, { areaApproved: e.target.checked })} />
                        <Badge tone={s.areaApproved ? 'success' : 'warning'}>{s.areaApproved ? 'Outside metro: approved' : 'Outside metro: approve?'}</Badge>
                      </label>
                    ) : <Badge tone="success">Metro</Badge>}
                  </td>
                  <td>
                    {outside ? (
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" className={cx(inputCls, 'h-9 w-24')} value={km[s.id] ?? s.travelKm ?? ''} onChange={e => setKm(k => ({ ...k, [s.id]: e.target.value }))} />
                        <Button size="sm" variant="secondary" disabled={km[s.id] === undefined} onClick={() => saveSite(s.id, { travelKm: km[s.id] })}>Save</Button>
                      </div>
                    ) : <span className="text-slate-400">No travel charge</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
