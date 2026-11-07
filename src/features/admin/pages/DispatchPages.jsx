// W14 Dispatch desk, W15 Job detail + assign technician, W16 Live technician map.
// Replaces the dispatch tab, AdminJobDetailsModal, AssignDispatchModal and LiveTechnicianMapModal.
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Radio, Search, Users, MapPin, Phone, FileText, CheckCircle2, Clock, AlertTriangle, Truck, Map as MapIcon, User, Camera, ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Kpi, Button, Tabs, Badge, InfoRow, Field, EmptyState, inputCls, useToast, cx } from '@/shared/ui/index.jsx';
import { StatusChip, SlaTimeline, MapEmbed, MediaStrip, isCompleted, isFinished, isLive, isNewJob, hasTech, formatDateTime } from '@/shared/ui/jobs.jsx';
import { JobList } from '@/features/customer/components/JobList.jsx';

const ACTIVE = ['ACCEPTED', 'TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'];

export function TechStatusBadge({ status }) {
  if (status === 'ON_SITE') return <Badge tone="warning">On a job</Badge>;
  if (status === 'AVAILABLE') return <Badge tone="success">Available</Badge>;
  return <Badge tone="slate">Off duty</Badge>;
}

export function DispatchPage() {
  const { jobs, technicians } = useAppData();
  const [params, setParams] = useSearchParams();
  const filter = params.get('status') || 'open';
  const [q, setQ] = useState('');

  const counts = {
    newJobs: jobs.filter(j => isNewJob(j.status)).length,
    unassigned: jobs.filter(j => !isFinished(j.status) && !hasTech(j)).length,
    enRoute: jobs.filter(j => j.status === 'TRAVELLING').length,
    onSite: jobs.filter(j => ['ARRIVED', 'IN_PROGRESS'].includes(j.status)).length,
    done: jobs.filter(j => isCompleted(j.status)).length
  };

  const shown = useMemo(() => jobs.filter(j => {
    if (filter === 'open' && isFinished(j.status)) return false;
    if (filter === 'new' && !isNewJob(j.status)) return false;
    if (filter === 'active' && !ACTIVE.includes(j.status)) return false;
    if (filter === 'done' && !isCompleted(j.status)) return false;
    if (q && !`${j.jobNumber} ${j.customerName} ${j.locationName} ${j.category} ${j.technicianName}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (hasTech(a) - hasTech(b)) || new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)), [jobs, filter, q]);

  const live = jobs.find(j => isLive(j.status));
  const available = technicians.filter(t => t.status === 'AVAILABLE');

  return (
    <Page fit title="Dispatch desk" subtitle="Live emergency requests across all customers"
      actions={<>
        <Button to="/admin/hotline" variant="emergency" icon={Phone}>Hotline booking</Button>
        <Button to="/admin/map" variant="secondary" icon={MapIcon}>Live map</Button>
      </>}>
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi label="New" value={counts.newJobs} icon={Radio} tone="brand" />
        <Kpi label="Unassigned" value={counts.unassigned} icon={AlertTriangle} tone={counts.unassigned ? 'danger' : 'slate'} />
        <Kpi label="On the way" value={counts.enRoute} icon={Truck} tone="brand" className="hidden sm:block" />
        <Kpi label="On site" value={counts.onSite} icon={MapPin} tone="warning" className="hidden xl:block" />
        <Kpi label="Completed" value={counts.done} icon={CheckCircle2} tone="success" className="hidden xl:block" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px] fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <Card title="Job queue" icon={Radio} className="fit:min-h-0" bodyClassName="fit:flex-1 fit:overflow-y-auto"
          actions={<>
            <Tabs value={filter} onChange={v => setParams({ status: v })} tabs={[
              { key: 'open', label: 'Open' }, { key: 'new', label: 'New', count: counts.newJobs }, { key: 'active', label: 'Active' }, { key: 'done', label: 'Done', count: counts.done }, { key: 'all', label: 'All', count: jobs.length }
            ]} />
            <label className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={cx(inputCls, 'h-9 py-1.5 pl-9')} placeholder="Search jobs" value={q} onChange={e => setQ(e.target.value)} aria-label="Search jobs" />
            </label>
          </>}>
          <JobList jobs={shown} showCustomer linkTo={j => `/admin/jobs/${j.id}`} emptyTitle="No jobs in this view" />
        </Card>
        <div className="flex min-h-0 flex-col gap-4">
          <Card title={live ? `Live: ${String(live.technicianName).replace(/\s*\(.*\)$/, '')}` : 'Live map'} icon={MapIcon} className="min-h-[220px] fit:flex-1" bodyClassName="flex-1 flex flex-col"
            actions={<Button to={live ? `/admin/map?job=${live.id}` : '/admin/map'} variant="ghost" size="sm">Open</Button>}>
            <MapEmbed address={live?.address || 'Adelaide SA'} zoom={live ? 14 : 11} className="min-h-[160px] flex-1" />
          </Card>
          <Card title={`Available technicians (${available.length})`} icon={Users} className="fit:min-h-0 fit:max-h-[45%]" bodyClassName="fit:overflow-y-auto">
            {available.length === 0 ? <p className="text-sm text-slate-500">Nobody is free right now.</p> : (
              <ul className="space-y-2">
                {available.map(t => (
                  <li key={t.id} className="flex items-center gap-2">
                    <Avatar tech={t} />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{t.name}</div><div className="text-xs text-slate-500">{t.phone}</div></div>
                    <Badge tone="success">Free</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}

export function Avatar({ tech, size = 'h-9 w-9' }) {
  return tech.avatar
    ? <img src={tech.avatar} alt="" className={cx(size, 'shrink-0 rounded-full border border-slate-200 object-cover')} />
    : <span className={cx(size, 'flex shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-brand-dark')}>{(tech.name || '?').charAt(0)}</span>;
}

export function AdminJobPage() {
  const { jobId } = useParams();
  const { jobs, technicians, upsertJob, reloadTechnicians, loaded } = useAppData();
  const { notify } = useToast();
  const job = jobs.find(j => j.id === jobId);
  const [tech, setTech] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [justAssigned, setJustAssigned] = useState(null);

  if (!job) return <Page breadcrumb={[{ label: 'Dispatch', to: '/admin/dispatch' }, { label: 'Job' }]}><Card><EmptyState title={loaded ? 'Job not found' : 'Loading…'} /></Card></Page>;

  // Older jobs store the name with a suffix ("Dave Miller (Tech ID #104)"), so match on the technician's name.
  const currentTech = hasTech(job) ? technicians.find(t => t.name === job.technicianName || job.technicianName.startsWith(`${t.name} (`)) : null;
  const current = hasTech(job) ? (currentTech?.name || job.technicianName) : null;
  const chosenTech = tech ?? (current || (technicians.find(t => t.status === 'AVAILABLE') || technicians[0])?.name);
  const chosenStatus = status ?? (!isNewJob(job.status) && ACTIVE.includes(job.status) ? job.status : 'TECH_ASSIGNED');
  const sorted = [...technicians].sort((a, b) => (a.name === current ? -2 : a.status === 'AVAILABLE' ? -1 : 1) - (b.name === current ? -2 : b.status === 'AVAILABLE' ? -1 : 1));
  const unchanged = chosenTech === current && chosenStatus === job.status && current === job.technicianName;
  const nextUnassigned = jobs.find(j => j.id !== job.id && isNewJob(j.status) && !hasTech(j));

  const assign = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/jobs/${job.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianName: chosenTech, status: chosenStatus })
      });
      const data = await res.json();
      if (!res.ok) notify(data.error || 'The technician could not be assigned.', 'danger');
      else {
        upsertJob(data); await reloadTechnicians();
        setTech(null); setStatus(null); setPicking(false); setJustAssigned(chosenTech);
        notify(`${chosenTech} assigned to ${job.jobNumber}.`);
      }
    } catch { notify('Cannot reach the server. Nothing was assigned.', 'danger'); }
    setBusy(false);
  };

  return (
    <Page title={`${job.jobNumber} · ${job.category}`} subtitle={`${job.customerName} · ${job.locationName || ''}`}
      breadcrumb={[{ label: 'Dispatch', to: '/admin/dispatch' }, { label: job.jobNumber }]}
      actions={<>
        <StatusChip status={job.status} />
        {isLive(job.status) && <Button to={`/admin/map?job=${job.id}`} variant="secondary" icon={MapIcon}>Track live</Button>}
        {isCompleted(job.status) && <Button to={`/admin/jobs/${job.id}/report`} icon={FileText}>Service report</Button>}
      </>}>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="order-2 min-w-0 space-y-4 xl:order-1">
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Customer contact" icon={User}>
              <dl className="grid grid-cols-2 gap-3">
                <InfoRow label="Customer"><Link to={`/admin/customers/${job.organizationId}`} className="text-brand hover:underline">{job.customerName}</Link></InfoRow>
                <InfoRow label="On-site contact">{job.onsiteContact}</InfoRow>
                <InfoRow label="Phone">{job.onsitePhone && <a href={`tel:${job.onsitePhone}`} className="text-brand underline">{job.onsitePhone}</a>}</InfoRow>
                <InfoRow label="Submitted">{formatDateTime(job.submittedAt || job.createdAt)}</InfoRow>
              </dl>
            </Card>
            <Card title="Site and access" icon={MapPin}>
              <dl className="grid gap-3">
                <InfoRow label="Address">{job.address}</InfoRow>
                <InfoRow label="Access">{job.accessInstructions}</InfoRow>
                <InfoRow label="Restrictions / parking">{[job.accessRestrictions, job.parkingInstructions].filter(Boolean).join(' · ')}</InfoRow>
              </dl>
            </Card>
          </div>
          <Card title="Incident" icon={ShieldAlert}>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge>{job.affectedArea ? `${job.affectedArea} m²` : 'Area not given'}</Badge>
              <Badge tone={job.isOngoing ? 'warning' : 'slate'}>{job.isOngoing ? 'Still ongoing' : 'Contained'}</Badge>
              <Badge tone={job.isSafeToAccess === false ? 'danger' : 'success'}>{job.isSafeToAccess === false ? 'Hazards reported' : 'Safe to access'}</Badge>
              <Badge>Incident time: {formatDateTime(job.incidentTime)}</Badge>
            </div>
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{job.description}</p>
          </Card>
          <Card title="Photos & videos" icon={Camera}><MediaStrip job={job} /></Card>
          <Card title="Progress" icon={Clock}><SlaTimeline job={job} /></Card>
        </div>

        <div className="order-1 space-y-4 xl:order-2">
          {current && !picking ? (
            <Card title="Assigned technician" icon={Users} className={cx(justAssigned && 'ring-2 ring-emerald-400')}>
              {justAssigned && (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><b>{justAssigned}</b> has been assigned and notified.</span>
                </div>
              )}
              <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-3">
                <Avatar tech={currentTech || { name: current }} size="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <div className="break-words text-base font-bold leading-tight text-slate-900">{current}</div>
                  <div className="text-xs text-slate-500">{currentTech?.phone}{currentTech?.rating ? ` · ★ ${currentTech.rating}` : ''}</div>
                </div>
                <Badge tone="success"><CheckCircle2 className="mr-1 inline h-3 w-3" />Assigned</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-500">Job status</span><StatusChip status={job.status} />
              </div>
              <div className="mt-4 grid gap-2">
                <Button block icon={ArrowLeft} to="/admin/dispatch">Back to dispatch list</Button>
                {nextUnassigned && <Button block variant="secondary" to={`/admin/jobs/${nextUnassigned.id}`}>Next unassigned job ({nextUnassigned.jobNumber})</Button>}
                {!isFinished(job.status) && <Button block variant="ghost" icon={RefreshCw} onClick={() => { setPicking(true); setJustAssigned(null); }}>Change technician or status</Button>}
              </div>
            </Card>
          ) : (
            <Card title={current ? 'Change technician' : 'Assign technician'} icon={Users}
              actions={current && <Button size="sm" variant="ghost" onClick={() => { setPicking(false); setTech(null); setStatus(null); }}>Cancel</Button>}>
              {isFinished(job.status) ? <p className="text-sm text-slate-500">This job is finished.</p> : (
                <>
                  <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {sorted.map(t => (
                      <li key={t.id}>
                        <button type="button" onClick={() => setTech(t.name)} className={cx('flex w-full items-center gap-2 rounded-xl border-2 p-2 text-left cursor-pointer', chosenTech === t.name ? 'border-brand bg-sky-50' : 'border-slate-200 hover:border-slate-300')}>
                          <Avatar tech={t} />
                          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{t.name}</div><div className="text-xs text-slate-500">{t.phone} · ★ {t.rating || 5.0}</div></div>
                          {t.name === current ? <Badge tone="brand">Current</Badge> : <TechStatusBadge status={t.status} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Field label="Status after assigning" className="mt-3">
                    <select className={inputCls} value={chosenStatus} onChange={e => setStatus(e.target.value)}>
                      <option value="TECH_ASSIGNED">Sent to technician (waiting for accept)</option>
                      <option value="ACCEPTED">Accepted, on the way soon</option>
                      <option value="IN_PROGRESS">On site, cleaning</option>
                      <option value="MORE_INFO_REQUIRED">More info needed (pauses SLA)</option>
                    </select>
                  </Field>
                  <Button block className="mt-3" disabled={busy || !chosenTech || unchanged} onClick={assign} icon={CheckCircle2}>
                    {busy ? 'Assigning…' : unchanged ? 'No changes to save' : current ? `Reassign to ${chosenTech}` : `Assign ${chosenTech || ''} & dispatch`}
                  </Button>
                </>
              )}
            </Card>
          )}
          <Card title="Location" icon={MapPin} bodyClassName="flex flex-col"><MapEmbed address={job.address} interactive className="h-56" /></Card>
        </div>
      </div>
    </Page>
  );
}

export function LiveMapPage() {
  const { jobs, technicians } = useAppData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const liveJobs = jobs.filter(j => isLive(j.status) || ['ACCEPTED', 'TECH_ASSIGNED'].includes(j.status));
  const selected = liveJobs.find(j => j.id === params.get('job')) || liveJobs[0];
  const tech = selected && technicians.find(t => t.name === selected.technicianName);

  return (
    <Page fit title="Live technician map" subtitle="Technicians on active jobs" breadcrumb={[{ label: 'Dispatch', to: '/admin/dispatch' }, { label: 'Live map' }]} backTo={false}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr] fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <Card title={`Active jobs (${liveJobs.length})`} icon={Truck} className="order-2 fit:min-h-0 lg:order-1" bodyClassName="fit:overflow-y-auto">
          {liveJobs.length === 0 ? <EmptyState title="No technicians on the road" /> : (
            <ul className="space-y-2">
              {liveJobs.map(j => (
                <li key={j.id}>
                  <button onClick={() => setParams({ job: j.id })} className={cx('w-full rounded-xl border-2 p-2.5 text-left cursor-pointer', selected?.id === j.id ? 'border-brand bg-sky-50' : 'border-slate-200 hover:border-slate-300')}>
                    <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{j.technicianName || 'Unassigned'}</span><StatusChip status={j.status} /></div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{j.jobNumber} · {j.customerName}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="order-1 flex min-h-0 flex-col gap-3 lg:order-2">
          <Card padded={false} className="min-h-[50vh] overflow-hidden fit:min-h-0 fit:flex-1" bodyClassName="flex-1 flex">
            <MapEmbed address={selected?.address || 'Adelaide SA'} zoom={selected ? 14 : 11} interactive className="min-h-[50vh] flex-1 rounded-none border-0 fit:min-h-0" />
          </Card>
          {selected && (
            <Card padded className="shrink-0">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:items-center">
                <InfoRow label="Technician">{selected.technicianName}</InfoRow>
                <InfoRow label="Job">{selected.jobNumber}</InfoRow>
                <InfoRow label="Distance">{selected.status === 'TRAVELLING' ? '1.4 km' : 'On site'}</InfoRow>
                <InfoRow label="ETA">{selected.status === 'TRAVELLING' ? '14 min' : 'Arrived'}</InfoRow>
                <div className="col-span-2 flex gap-2 md:col-span-1 md:justify-end">
                  <Button size="sm" variant="success" icon={Phone} href={`tel:${tech?.phone || ''}`}>Call</Button>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/jobs/${selected.id}`)}>Job</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}
