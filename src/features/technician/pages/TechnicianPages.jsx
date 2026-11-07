// W11–W13 Technician pages: job queue, job detail with status workflow, history and profile.
// Phones are the main device here, so the next status action is a big button pinned to the bottom.
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Wrench, Navigation, Phone, MapPin, CheckCircle2, Clock, Star, FileText, User, AlertTriangle, Save, Lock, ChevronRight } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Kpi, Button, Tabs, Badge, InfoRow, Field, Alert, EmptyState, StickyActions, inputCls, useToast, useBreakpoint, cx } from '@/shared/ui/index.jsx';
import { StatusChip, MapEmbed, MediaStrip, isCompleted, formatDateTime, hasTech } from '@/shared/ui/jobs.jsx';

const AWAITING = ['NEW', 'SUBMITTED', 'TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED'];
const ONGOING = ['ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'];

// Next step in the technician workflow for each status
const NEXT = {
  NEW: { to: 'ACCEPTED', label: 'Accept job' },
  SUBMITTED: { to: 'ACCEPTED', label: 'Accept job' },
  TECH_ASSIGNED: { to: 'ACCEPTED', label: 'Accept job' },
  TECHNICIAN_ASSIGNED: { to: 'ACCEPTED', label: 'Accept job' },
  ACCEPTED: { to: 'TRAVELLING', label: 'Start travelling' },
  TRAVELLING: { to: 'ARRIVED', label: "I've arrived on site" },
  ARRIVED: { to: 'IN_PROGRESS', label: 'Start cleaning' },
  IN_PROGRESS: { to: 'COMPLETED', label: 'Complete job' }
};
const WORKFLOW = [
  { s: 'ACCEPTED', label: 'Accepted' }, { s: 'TRAVELLING', label: 'Travelling' }, { s: 'ARRIVED', label: 'Arrived' },
  { s: 'IN_PROGRESS', label: 'Cleaning' }, { s: 'COMPLETED', label: 'Completed' }
];

function useMyJobs() {
  const { jobs, currentUser } = useAppData();
  return useMemo(() => jobs.filter(j => {
    if (!hasTech(j)) return false;
    if (currentUser?.role === 'technician' && currentUser?.name) return (j.technicianName || '').toLowerCase().includes(currentUser.name.toLowerCase());
    return true; // admins viewing the technician workspace see every assigned job
  }), [jobs, currentUser]);
}

function useStatusUpdate() {
  const { upsertJob } = useAppData();
  const { notify } = useToast();
  return async (job, status) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${job.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'The status could not be updated.', 'danger'); return false; }
      upsertJob(data);
      return true;
    } catch {
      notify('No connection. The status was not changed, please try again.', 'danger');
      return false;
    }
  };
}

export function TechJobsPage() {
  const mine = useMyJobs();
  const { currentUser, technicians } = useAppData();
  const [tab, setTab] = useState('assigned');
  const assigned = mine.filter(j => AWAITING.includes(j.status));
  const ongoing = mine.filter(j => ONGOING.includes(j.status));
  const today = new Date().toDateString();
  const doneToday = mine.filter(j => isCompleted(j.status) && new Date(j.completedAt || j.updatedAt || 0).toDateString() === today);
  const me = technicians.find(t => t.name === currentUser?.name);
  const list = tab === 'assigned' ? assigned : ongoing;
  const focus = ongoing[0] || assigned[0];

  return (
    <Page fit title={`Hi ${(currentUser?.name || '').split(' ')[0] || 'there'}`} subtitle="Your dispatched and active emergency jobs">
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Waiting for you" value={assigned.length} icon={Clock} tone={assigned.length ? 'danger' : 'slate'} />
        <Kpi label="Active" value={ongoing.length} icon={Wrench} tone="warning" />
        <Kpi label="Done today" value={doneToday.length} icon={CheckCircle2} tone="success" className="hidden lg:block" />
        <Kpi label="Rating" value={`${me?.rating || 5.0} / 5`} icon={Star} tone="brand" className="hidden lg:block" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr] fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <Card title="Job queue" icon={Wrench} className="fit:min-h-0" bodyClassName="fit:flex-1 fit:overflow-y-auto"
          actions={<Tabs value={tab} onChange={setTab} tabs={[{ key: 'assigned', label: 'New', count: assigned.length }, { key: 'ongoing', label: 'Active', count: ongoing.length }]} />}>
          {list.length === 0 ? (
            <EmptyState title={tab === 'assigned' ? 'No new jobs' : 'No active jobs'}>{tab === 'assigned' ? 'New dispatches from the admin desk appear here.' : 'Accept a job to start it.'}</EmptyState>
          ) : (
            <ul className="space-y-2">{list.map(j => <TechJobCard key={j.id} job={j} />)}</ul>
          )}
        </Card>
        <Card title={focus ? `Next: ${focus.locationName || focus.address}` : 'Today'} icon={MapPin} className="hidden min-h-[320px] lg:flex fit:min-h-0" bodyClassName="flex-1 flex flex-col">
          {focus ? <MapEmbed address={focus.address} interactive className="min-h-[260px] flex-1" /> : <EmptyState title="Nothing scheduled" />}
        </Card>
      </div>
    </Page>
  );
}

function TechJobCard({ job }) {
  const navigate = useNavigate();
  const update = useStatusUpdate();
  const next = NEXT[job.status];
  const [busy, setBusy] = useState(false);
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <button onClick={() => navigate(`/tech/jobs/${job.id}`)} className="block w-full text-left cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold text-brand">{job.jobNumber}</span>
          <StatusChip status={job.status} />
        </div>
        <div className="mt-1 text-sm font-bold text-slate-900">{job.category} · {job.customerName}</div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{job.address}</span></div>
      </button>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button size="sm" variant="secondary" icon={Navigation} href={`https://maps.google.com/?q=${encodeURIComponent(job.address || '')}`} target="_blank" rel="noreferrer">Navigate</Button>
        <Button size="sm" variant="secondary" icon={Phone} href={`tel:${job.onsitePhone || ''}`}>Call</Button>
        {next ? (
          <Button size="sm" variant={next.to === 'ACCEPTED' ? 'primary' : 'success'} disabled={busy} onClick={async () => { setBusy(true); await update(job, next.to); setBusy(false); }}>
            {busy ? '…' : next.to === 'ACCEPTED' ? 'Accept' : 'Next step'}
          </Button>
        ) : <Button size="sm" variant="ghost" to={`/tech/jobs/${job.id}`}>Open</Button>}
      </div>
    </li>
  );
}

export function TechJobDetailPage() {
  const { jobId } = useParams();
  const { jobs, loaded } = useAppData();
  const job = jobs.find(j => j.id === jobId);
  const update = useStatusUpdate();
  const { notify } = useToast();
  const bp = useBreakpoint();
  const [busy, setBusy] = useState(false);

  if (!job) return <Page breadcrumb={[{ label: 'My jobs', to: '/tech/jobs' }, { label: 'Job' }]}><Card><EmptyState title={loaded ? 'Job not found' : 'Loading…'} /></Card></Page>;

  const next = NEXT[job.status];
  const stepIndex = WORKFLOW.findIndex(w => w.s === job.status);
  const go = async (status) => {
    setBusy(true);
    const ok = await update(job, status);
    if (ok) notify(status === 'COMPLETED' ? 'Job completed. The service report is ready.' : `Status updated: ${status.replace(/_/g, ' ').toLowerCase()}.`);
    setBusy(false);
  };

  const nextButton = next && (
    <Button size="lg" block variant={next.to === 'COMPLETED' ? 'success' : 'primary'} disabled={busy} onClick={() => go(next.to)}>{busy ? 'Saving…' : next.label}</Button>
  );

  return (
    <Page title={`${job.category} · ${job.customerName}`} subtitle={job.address}
      breadcrumb={[{ label: 'My jobs', to: '/tech/jobs' }, { label: job.jobNumber }]}
      actions={<>
        <StatusChip status={job.status} />
        {isCompleted(job.status) && <Button to={`/tech/jobs/${job.id}/report`} icon={FileText}>Service report</Button>}
      </>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card title="Status" icon={Clock}>
            <ol className="flex items-center gap-1">
              {WORKFLOW.map((w, i) => (
                <li key={w.s} className="flex flex-1 flex-col items-center gap-1 text-center">
                  <span className={cx('h-2 w-full rounded-full', i <= stepIndex || isCompleted(job.status) ? 'bg-emerald-500' : 'bg-slate-200')} />
                  <span className={cx('text-[10px] font-semibold md:text-xs', i === stepIndex ? 'text-brand-dark' : 'text-slate-500')}>{w.label}</span>
                </li>
              ))}
            </ol>
            {bp !== 'mobile' && next && <div className="mt-4">{nextButton}</div>}
            {job.status === 'ARRIVED' && (
              <Button variant="danger-soft" size="sm" className="mt-3" icon={AlertTriangle} disabled={busy} onClick={() => go('UNABLE_TO_ACCESS')}>Can't get in (unable to access)</Button>
            )}
            {job.status === 'IN_PROGRESS' && job.timerMinutes !== undefined && <p className="mt-3 text-xs text-slate-500">Cleaning for {job.timerMinutes} min.</p>}
          </Card>
          <Card title="Customer and site" icon={User}>
            <dl className="grid grid-cols-2 gap-3">
              <InfoRow label="Customer">{job.customerName}</InfoRow>
              <InfoRow label="Site">{job.locationName}</InfoRow>
              <InfoRow label="On-site contact">{job.onsiteContact}</InfoRow>
              <InfoRow label="Phone">{job.onsitePhone && <a href={`tel:${job.onsitePhone}`} className="text-brand underline">{job.onsitePhone}</a>}</InfoRow>
            </dl>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={Navigation} href={`https://maps.google.com/?q=${encodeURIComponent(job.address || '')}`} target="_blank" rel="noreferrer">Navigate</Button>
              <Button variant="secondary" icon={Phone} href={`tel:${job.onsitePhone || ''}`}>Call contact</Button>
            </div>
          </Card>
          <Card title="Access and safety" icon={Lock}>
            <dl className="grid gap-3 sm:grid-cols-3">
              <InfoRow label="Access">{job.accessInstructions}</InfoRow>
              <InfoRow label="Restrictions">{job.accessRestrictions}</InfoRow>
              <InfoRow label="Parking / security">{job.parkingInstructions}</InfoRow>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={job.isSafeToAccess === false ? 'danger' : 'success'}>{job.isSafeToAccess === false ? 'Hazards reported' : 'Safe to access'}</Badge>
              <Badge tone={job.isOngoing ? 'warning' : 'slate'}>{job.isOngoing ? 'Still ongoing' : 'Contained'}</Badge>
              {job.affectedArea ? <Badge>{job.affectedArea} m²</Badge> : null}
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="What happened">
            <p className="text-sm text-slate-700">{job.description || 'No description.'}</p>
            <div className="mt-3"><MediaStrip job={job} /></div>
          </Card>
          <Card title="Map" icon={MapPin} bodyClassName="flex flex-col">
            <MapEmbed address={job.address} interactive className="h-64 lg:h-80" />
          </Card>
          <p className="text-xs text-slate-500">Submitted {formatDateTime(job.submittedAt || job.createdAt)} · target attendance within 2–4 hours</p>
        </div>
      </div>
      {bp === 'mobile' && next && <StickyActions className="!justify-stretch">{nextButton}</StickyActions>}
    </Page>
  );
}

export function TechHistoryPage() {
  const mine = useMyJobs();
  const done = mine.filter(j => isCompleted(j.status));
  return (
    <Page fit title="Job history" subtitle="Completed jobs and their service reports" breadcrumb={[{ label: 'My jobs', to: '/tech/jobs' }, { label: 'History' }]}>
      <Card className="fit:min-h-0 fit:flex-1" bodyClassName="fit:flex-1 fit:overflow-y-auto">
        {done.length === 0 ? <EmptyState title="No completed jobs yet" /> : (
          <ul className="divide-y divide-slate-100">
            {done.map(j => (
              <li key={j.id}>
                <Link to={`/tech/jobs/${j.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{j.category} · {j.customerName}</div>
                    <div className="truncate text-xs text-slate-500">{j.jobNumber} · {j.address}</div>
                  </div>
                  <span className="hidden text-xs text-slate-500 sm:block">{formatDateTime(j.completedAt || j.updatedAt)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}

export function TechProfilePage() {
  const { currentUser, setCurrentUser } = useAppData();
  const { notify } = useToast();
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (password && password.length < 8) return setError('The new password must be at least 8 characters.');
    setSaving(true);
    try {
      const techId = currentUser?.techId || currentUser?.technicianId || currentUser?.id;
      const res = await fetch(`${API_BASE}/technicians/${techId}/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, password: password || undefined })
      });
      const data = await res.json();
      if (res.ok) { setCurrentUser({ ...currentUser, name, phone, avatar }); setPassword(''); notify('Profile saved.'); }
      else setError(data.error || 'The profile could not be saved.');
    } catch { setError('Cannot reach the server. Nothing was saved.'); }
    setSaving(false);
  };

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onloadend = () => setAvatar(r.result);
    r.readAsDataURL(file);
  };

  return (
    <Page title="Profile" subtitle="Your details and password" breadcrumb={[{ label: 'My jobs', to: '/tech/jobs' }, { label: 'Profile' }]} width="medium">
      <form onSubmit={save} className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="items-center text-center">
          <div className="flex flex-col items-center gap-3">
            {avatar ? <img src={avatar} alt="" className="h-24 w-24 rounded-full border border-slate-200 object-cover" />
              : <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-3xl font-bold text-white">{(name || 'T').charAt(0)}</span>}
            <div><div className="font-bold text-slate-900">{name}</div><div className="text-xs text-slate-500">{currentUser?.email}</div></div>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Change photo<input type="file" accept="image/*" capture="user" className="hidden" onChange={onPhoto} />
            </label>
          </div>
        </Card>
        <div className="space-y-4">
          <Alert>{error}</Alert>
          <Card title="Details" icon={User}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Full name" required><input required className={inputCls} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></Field>
              <Field label="Mobile phone" required><input required type="tel" className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></Field>
              <Field label="Email (login)"><input className={cx(inputCls, 'bg-slate-50')} value={currentUser?.email || ''} disabled /></Field>
            </div>
          </Card>
          <Card title="Security" icon={Lock}>
            <Field label="New password" hint="Leave blank to keep your current password"><input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></Field>
          </Card>
          <StickyActions><Button type="submit" icon={Save} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button></StickyActions>
        </div>
      </form>
    </Page>
  );
}
