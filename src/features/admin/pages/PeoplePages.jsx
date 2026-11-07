// W17 Customers (+ new customer page), W18 Technicians (+ add / edit pages).
// Replaces the Customers and Technicians tabs, AddTechnicianModal, EditTechnicianModal and the temp-password alert().
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Plus, Search, Eye, MapPin, ClipboardList, Users, Copy, CheckCircle2, Save, Trash2, Edit3, Phone, Star, UploadCloud, KeyRound } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Kpi, Button, Tabs, Badge, InfoRow, Field, Alert, EmptyState, StickyActions, InlineConfirm, inputCls, useToast, cx } from '@/shared/ui/index.jsx';
import { JobList } from '@/features/customer/components/JobList.jsx';
import { Avatar, TechStatusBadge } from './DispatchPages.jsx';

/* ------------------------------------------------------------------ Customers */

export function CustomersPage() {
  const { customers, config } = useAppData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const shown = customers.filter(c =>
    (!plan || c.membershipPlan === plan) &&
    (!q || `${c.businessName} ${c.abn} ${c.primaryContactName} ${c.email}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <Page fit title="Customers" subtitle={`${customers.length} business accounts`}
      actions={<Button to="/admin/customers/new" icon={Plus}>Register company</Button>}>
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
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="py-2.5 pr-3">Business</th><th className="py-2.5 pr-3">Contact</th><th className="py-2.5 pr-3">Plan</th>
                <th className="hidden py-2.5 pr-3 lg:table-cell">Call-outs used</th><th className="hidden py-2.5 pr-3 lg:table-cell">Points</th><th className="py-2.5 pr-3">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/admin/customers/${c.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="py-3 pr-3"><div className="font-semibold text-slate-900">{c.businessName}</div><div className="text-xs text-slate-500">ABN {c.abn} · {(c.locations || []).length} site(s)</div></td>
                    <td className="py-3 pr-3"><div className="text-slate-800">{c.primaryContactName || c.primaryContact}</div><div className="text-xs text-slate-500">{c.phoneNumber || c.phone}</div></td>
                    <td className="py-3 pr-3 font-semibold capitalize text-brand-dark">{c.membershipPlan}</td>
                    <td className="hidden py-3 pr-3 lg:table-cell">{c.calloutsUsed ?? 0}</td>
                    <td className="hidden py-3 pr-3 font-semibold text-purple-700 lg:table-cell">{c.pointsBalance ?? 0}</td>
                    <td className="py-3 pr-3"><Badge tone={c.subscriptionStatus === 'CANCELLED' ? 'danger' : 'success'}>{c.subscriptionStatus === 'CANCELLED' ? 'Cancelled' : 'Active'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-2 md:hidden">
              {shown.map(c => (
                <li key={c.id}><Link to={`/admin/customers/${c.id}`} className="block rounded-xl border border-slate-200 p-3">
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
  const [tab, setTab] = useState('overview');
  const c = customers.find(x => x.id === customerId);
  if (!c) return <Page breadcrumb={[{ label: 'Customers', to: '/admin/customers' }, { label: 'Customer' }]}><Card><EmptyState title="Customer not found" /></Card></Page>;
  const plan = (config.membershipPlans || []).find(p => p.id === c.membershipPlan);
  const theirJobs = jobs.filter(j => j.organizationId === c.id);

  return (
    <Page title={c.businessName} subtitle={`ABN ${c.abn}`} breadcrumb={[{ label: 'Customers', to: '/admin/customers' }, { label: c.businessName }]}
      actions={<Button variant="secondary" icon={Eye} onClick={() => { setSelectedCustomerId(c.id); navigate('/app'); }}>Open customer view</Button>}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Plan" value={plan?.name || c.membershipPlan} sub={plan ? `$${plan.price}/mo` : ''} />
        <Kpi label="Call-outs used" value={`${c.calloutsUsed ?? 0} / ${plan?.callouts ?? '–'}`} tone="success" />
        <Kpi label="Points" value={c.pointsBalance ?? 0} tone="rewards" />
        <Kpi label="Jobs" value={theirJobs.length} tone="slate" />
      </div>
      <Tabs className="mt-4" value={tab} onChange={setTab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'sites', label: 'Sites', count: (c.locations || []).length }, { key: 'jobs', label: 'Jobs', count: theirJobs.length }]} />
      <div className="mt-3">
        {tab === 'overview' && (
          <Card title="Account details" icon={Building2}>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Primary contact">{c.primaryContactName || c.primaryContact}</InfoRow>
              <InfoRow label="Phone">{c.phoneNumber || c.phone}</InfoRow>
              <InfoRow label="Email">{c.email}</InfoRow>
              <InfoRow label="Payment method">{c.paymentMethod}</InfoRow>
              <InfoRow label="Membership">{c.subscriptionStatus === 'CANCELLED' ? 'Cancelled' : 'Active'}</InfoRow>
              <InfoRow label="Member for">{c.consecutiveMonths ?? 0} months</InfoRow>
            </dl>
          </Card>
        )}
        {tab === 'sites' && (
          <Card title="Sites" icon={MapPin}>
            {(c.locations || []).length === 0 ? <EmptyState title="No sites" /> : (
              <ul className="grid gap-3 md:grid-cols-2">
                {c.locations.map(l => (
                  <li key={l.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold text-slate-900">{l.name}</div><div className="text-sm text-slate-600">{l.address}</div>
                    {l.accessInstructions && <div className="mt-1 text-xs text-slate-500">Access: {l.accessInstructions}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {tab === 'jobs' && <Card title="Jobs" icon={ClipboardList}><JobList jobs={theirJobs} linkTo={j => `/admin/jobs/${j.id}`} /></Card>}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ Technicians */

export function TechniciansPage() {
  const { technicians } = useAppData();
  const [tab, setTab] = useState('all');
  const shown = technicians.filter(t => tab === 'all' || t.status === tab);
  const count = (s) => technicians.filter(t => t.status === s).length;
  return (
    <Page title="Technicians" subtitle={`${technicians.length} field technicians`} actions={<Button to="/admin/technicians/new" icon={Plus}>Add technician</Button>}>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'all', label: 'All', count: technicians.length }, { key: 'AVAILABLE', label: 'Available', count: count('AVAILABLE') },
        { key: 'ON_SITE', label: 'On a job', count: count('ON_SITE') }, { key: 'OFF_DUTY', label: 'Off duty', count: count('OFF_DUTY') }
      ]} />
      {shown.length === 0 ? <Card className="mt-4"><EmptyState title="Nobody here" /></Card> : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map(t => (
            <li key={t.id}>
              <Link to={`/admin/technicians/${t.id}`} className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300">
                <div className="flex items-center gap-3">
                  <Avatar tech={t} size="h-12 w-12" />
                  <div className="min-w-0 flex-1"><div className="truncate font-bold text-slate-900">{t.name}</div><div className="truncate text-xs text-slate-500">{t.email || ''}</div></div>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{t.phone}</span>
                  <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" />{t.rating || 5.0}</span>
                </div>
                <div className="flex items-center justify-between"><TechStatusBadge status={t.status} /><span className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><Edit3 className="h-3 w-3" />Edit</span></div>
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
  const { technicians, setTechnicians, jobs } = useAppData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const existing = techId ? technicians.find(t => t.id === techId) : null;
  const [form, setForm] = useState(() => ({
    name: existing?.name || '', phone: existing?.phone || '', email: existing?.email || '',
    status: existing?.status || 'AVAILABLE', rating: existing?.rating || 5.0, avatar: existing?.avatar || ''
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // { email, tempPassword } shown once
  const [copied, setCopied] = useState(false);
  const theirJobs = useMemo(() => existing ? jobs.filter(j => j.technicianName === existing.name) : [], [jobs, existing]);

  if (techId && !existing) return <Page breadcrumb={[{ label: 'Technicians', to: '/admin/technicians' }, { label: 'Technician' }]}><Card><EmptyState title="Technician not found" /></Card></Page>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const onPhoto = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onloadend = () => setForm(x => ({ ...x, avatar: r.result })); r.readAsDataURL(f); };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (form.name.trim().length < 2) return setError('Please enter the technician\'s full name.');
    if (!/^\d{8,12}$/.test(form.phone.replace(/[\s\-()+]/g, ''))) return setError('Please enter a valid phone number (8 to 12 digits).');
    setSaving(true);
    try {
      const body = existing ? { ...existing, ...form, rating: parseFloat(form.rating) || 5 } : { name: form.name, phone: form.phone, email: form.email || undefined, status: form.status, avatar: form.avatar };
      const res = await fetch(existing ? `${API_BASE}/technicians/${existing.id}` : `${API_BASE}/technicians`, {
        method: existing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const saved = await res.json();
      if (!res.ok || !saved.id) { setError(saved.error || 'The technician could not be saved.'); setSaving(false); return; }
      const { tempPassword, ...tech } = saved;
      if (existing) {
        setTechnicians(technicians.map(t => t.id === tech.id ? { ...t, ...tech } : t));
        notify('Technician saved.');
        navigate('/admin/technicians');
      } else {
        setTechnicians([...technicians, tech]);
        setCreated({ name: tech.name, email: tech.email, tempPassword });
      }
    } catch { setError('Cannot reach the server. Nothing was saved.'); }
    setSaving(false);
  };

  const remove = async () => {
    try {
      const res = await fetch(`${API_BASE}/technicians/${existing.id}`, { method: 'DELETE' });
      if (res.ok) { setTechnicians(technicians.filter(t => t.id !== existing.id)); notify('Technician removed.'); navigate('/admin/technicians'); }
      else { const d = await res.json().catch(() => ({})); notify(d.error || 'The technician could not be removed.', 'danger'); }
    } catch { notify('Cannot reach the server. Nothing was removed.', 'danger'); }
  };

  if (created) {
    return (
      <Page title="Technician added" breadcrumb={[{ label: 'Technicians', to: '/admin/technicians' }, { label: 'New' }]} width="narrow">
        <Card tone="success" title={`${created.name} can now sign in`} icon={CheckCircle2}>
          <p className="text-sm text-emerald-900">Give these login details to the technician. The temporary password is shown only once; they can change it in their profile.</p>
          <dl className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-white p-4 sm:grid-cols-2">
            <InfoRow label="Login email">{created.email}</InfoRow>
            <InfoRow label="Temporary password"><span className="font-mono">{created.tempPassword || '(set by you)'}</span></InfoRow>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={copied ? CheckCircle2 : Copy} onClick={async () => { try { await navigator.clipboard.writeText(`Login: ${created.email}\nTemporary password: ${created.tempPassword}`); setCopied(true); } catch { /* clipboard blocked */ } }}>{copied ? 'Copied' : 'Copy details'}</Button>
            <Button variant="secondary" to="/admin/technicians">Back to technicians</Button>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page title={existing ? existing.name : 'Add technician'} subtitle={existing ? existing.email : 'A login is created and a temporary password shown once'}
      breadcrumb={[{ label: 'Technicians', to: '/admin/technicians' }, { label: existing ? existing.name : 'New' }]} width="medium">
      <form onSubmit={save} className="grid gap-4 lg:grid-cols-[220px_1fr]">
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
              <Field label="Full name" required><input className={inputCls} value={form.name} onChange={set('name')} placeholder="e.g. Jason Blake" /></Field>
              <Field label="Mobile phone" required><input type="tel" className={inputCls} value={form.phone} onChange={set('phone')} placeholder="0499 111 222" /></Field>
              {!existing && <Field label="Login email" hint="Leave blank to create one automatically"><input type="email" className={inputCls} value={form.email} onChange={set('email')} /></Field>}
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={set('status')}>
                  <option value="AVAILABLE">Available</option><option value="ON_SITE">On a job</option><option value="OFF_DUTY">Off duty</option>
                </select>
              </Field>
              {existing && <Field label="Rating (1–5)"><input type="number" min="1" max="5" step="0.1" className={inputCls} value={form.rating} onChange={set('rating')} /></Field>}
            </div>
          </Card>
          {existing && (
            <Card title={`Jobs (${theirJobs.length})`} icon={ClipboardList}>
              <JobList jobs={theirJobs} linkTo={j => `/admin/jobs/${j.id}`} compact emptyTitle="No jobs yet" />
            </Card>
          )}
          <StickyActions>
            {existing && <span className="mr-auto"><InlineConfirm label="Remove" icon={Trash2} message="Remove this technician?" confirmLabel="Remove" onConfirm={remove} /></span>}
            <Button variant="ghost" to="/admin/technicians">Cancel</Button>
            <Button type="submit" icon={existing ? Save : KeyRound} disabled={saving}>{saving ? 'Saving…' : existing ? 'Save changes' : 'Add & create login'}</Button>
          </StickyActions>
        </div>
      </form>
    </Page>
  );
}
