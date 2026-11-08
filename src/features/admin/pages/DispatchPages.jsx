// W14 Dispatch desk, W15 Job detail + assign technician, W16 Live technician map.
// Replaces the dispatch tab, AdminJobDetailsModal, AssignDispatchModal and LiveTechnicianMapModal.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Radio, Search, Users, MapPin, Phone, FileText, CheckCircle2, Clock, AlertTriangle, Truck, Map as MapIcon, User, Camera, ShieldAlert, ArrowLeft, RefreshCw, ClipboardCheck, Receipt, Gift, ListChecks } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Kpi, Button, Tabs, Badge, InfoRow, Field, EmptyState, inputCls, useToast, cx } from '@/shared/ui/index.jsx';
import { StatusChip, SlaTimeline, MapEmbed, MediaStrip, isCompleted, isFinished, isLive, isNewJob, hasTech, formatDateTime, ChargesTable, TriageBadge, targetText } from '@/shared/ui/jobs.jsx';
import { useJobAction } from '@/app/useJobAction.js';
import { ReportPdfButton } from '@/reports/ReportPdfButton.jsx';
import { fmtDate, fmtMoney } from '@/shared/ui/membership.jsx';
import { TRIAGE, WATER_TYPES, HAZARDS, surchargeFor, insideServiceWindow, inWaitingPeriod } from '@shared/membership.js';

// Dispatch priority (cl. 13.3): Premium, Business, Essential, then non-members; within a tier, by acknowledgment time
const queueOrder = (a, b) => (isFinished(a.status) - isFinished(b.status))
  || (isFinished(a.status) ? new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0) : 0)
  || ((a.priorityTier || 4) - (b.priorityTier || 4))
  || new Date(a.acknowledgedAt || a.submittedAt || 0) - new Date(b.acknowledgedAt || b.submittedAt || 0);
import { JobList } from '@/features/customer/components/JobList.jsx';

const ACTIVE = ['ACCEPTED', 'TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'];

export function TechStatusBadge({ status }) {
  if (status === 'ON_SITE') return <Badge tone="warning">On a job</Badge>;
  if (status === 'AVAILABLE') return <Badge tone="success">Available</Badge>;
  return <Badge tone="slate">Off duty</Badge>;
}

// Filters opened from the tiles that have no tab of their own
const EXTRA_FILTERS = { unassigned: 'Unassigned', travelling: 'On the way', onsite: 'On site' };

export function DispatchPage() {
  const { jobs, technicians } = useAppData();
  const [params, setParams] = useSearchParams();
  const filter = params.get('status') || 'open';
  const [q, setQ] = useState(params.get('q') || '');
  const tile = (status) => `/admin/dispatch?status=${status}`;

  const counts = {
    newJobs: jobs.filter(j => isNewJob(j.status)).length,
    toTriage: jobs.filter(j => !isFinished(j.status) && (!j.acknowledgedAt || !j.triage || j.triage === 'GREY_AREA')).length,
    unassigned: jobs.filter(j => !isFinished(j.status) && !hasTech(j)).length,
    enRoute: jobs.filter(j => j.status === 'TRAVELLING').length,
    onSite: jobs.filter(j => ['ARRIVED', 'IN_PROGRESS'].includes(j.status)).length,
    done: jobs.filter(j => isCompleted(j.status)).length
  };

  const shown = useMemo(() => jobs.filter(j => {
    if (filter === 'open' && isFinished(j.status)) return false;
    if (filter === 'new' && !isNewJob(j.status)) return false;
    if (filter === 'triage' && (isFinished(j.status) || (j.acknowledgedAt && j.triage && j.triage !== 'GREY_AREA'))) return false;
    if (filter === 'active' && !ACTIVE.includes(j.status)) return false;
    if (filter === 'done' && !isCompleted(j.status)) return false;
    if (filter === 'unassigned' && (isFinished(j.status) || hasTech(j))) return false;
    if (filter === 'travelling' && j.status !== 'TRAVELLING') return false;
    if (filter === 'onsite' && !['ARRIVED', 'IN_PROGRESS'].includes(j.status)) return false;
    if (q && !`${j.jobNumber} ${j.customerName} ${j.locationName} ${j.category} ${j.technicianName}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort(queueOrder), [jobs, filter, q]);

  const live = jobs.find(j => isLive(j.status));
  const available = technicians.filter(t => t.status === 'AVAILABLE');

  return (
    <Page fit title="Dispatch desk" subtitle="Live emergency requests across all customers"
      actions={<>
        <Button to="/admin/hotline" variant="emergency" icon={Phone} title="Log an emergency for a customer who is on the phone">Hotline booking</Button>
        <Button to="/admin/map" variant="secondary" icon={MapIcon} title="See where every technician and job is on the map">Live map</Button>
      </>}>
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi label="To acknowledge / triage" value={counts.toTriage} icon={Radio} tone={counts.toTriage ? 'danger' : 'brand'} to={tile('triage')} title="Requests SACC has not acknowledged or triaged yet" />
        <Kpi label="Unassigned" value={counts.unassigned} icon={AlertTriangle} tone={counts.unassigned ? 'danger' : 'slate'} to={tile('unassigned')} title="Show open jobs with no technician yet" />
        <Kpi label="On the way" value={counts.enRoute} icon={Truck} tone="brand" className="hidden sm:block" to={tile('travelling')} title="Show jobs where the technician is travelling" />
        <Kpi label="On site" value={counts.onSite} icon={MapPin} tone="warning" className="hidden xl:block" to={tile('onsite')} title="Show jobs where the technician is on site" />
        <Kpi label="Completed" value={counts.done} icon={CheckCircle2} tone="success" className="hidden xl:block" to={tile('done')} title="Show completed jobs" />
      </div>
      <AttentionStrip jobs={jobs} />
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px] fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <Card title="Job queue (by plan priority)" icon={Radio} className="fit:min-h-0" bodyClassName="fit:flex-1 fit:overflow-y-auto"
          actions={<>
            <Tabs value={filter} onChange={v => setParams({ status: v })} tabs={[
              { key: 'open', label: 'Open' }, { key: 'triage', label: 'Triage', count: counts.toTriage }, { key: 'new', label: 'New', count: counts.newJobs }, { key: 'active', label: 'Active' }, { key: 'done', label: 'Done', count: counts.done }, { key: 'all', label: 'All', count: jobs.length },
              ...(EXTRA_FILTERS[filter] ? [{ key: filter, label: EXTRA_FILTERS[filter] }] : [])
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
            actions={<Button to={live ? `/admin/map?job=${live.id}` : '/admin/map'} variant="ghost" size="sm" title="Open the full live map">Open</Button>}>
            <MapEmbed address={live?.address || 'Adelaide SA'} zoom={live ? 14 : 11} className="min-h-[160px] flex-1" />
          </Card>
          <Card title={`Available technicians (${available.length})`} icon={Users} className="fit:min-h-0 fit:max-h-[45%]" bodyClassName="fit:overflow-y-auto">
            {available.length === 0 ? <p className="text-sm text-slate-500">Nobody is free right now.</p> : (
              <ul className="space-y-2">
                {available.map(t => (
                  <li key={t.id} className="flex items-center gap-2">
                    <Avatar tech={t} />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{t.name}</div><div className="text-xs text-slate-500">{t.phone}</div></div>
                    {t.waitingJobs ? <Badge tone="warning">{t.waitingJobs} waiting</Badge> : <Badge tone="success">Free</Badge>}
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
  const { jobs, technicians, upsertJob, reloadTechnicians, loaded, customers, config } = useAppData();
  const { notify } = useToast();
  const act = useJobAction();
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
  const org = customers.find(c => c.id === job.organizationId);
  const readyToDispatch = job.triage === 'COVERED' || job.quoteStatus === 'ACCEPTED';

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
        {isLive(job.status) && <Button title="Follow the technician's location on the map" to={`/admin/map?job=${job.id}`} variant="secondary" icon={MapIcon}>Track live</Button>}
        {!job.acknowledgedAt && !isFinished(job.status) && <Button title="Acknowledge the request: starts the 2–4 hour response clock" variant="emergency" icon={ClipboardCheck} onClick={() => act(job, 'acknowledge', {}, 'Acknowledged. The response clock has started.')}>Acknowledge</Button>}
        {(isCompleted(job.status) || job.status === 'UNABLE_TO_ACCESS' || job.reportIssuedAt) && <Button title="Open the service report for this job" to={`/admin/jobs/${job.id}/report`} variant={job.reportIssuedAt ? 'primary' : 'secondary'} icon={FileText}>{job.reportIssuedAt ? `Report ${job.reportNumber}` : 'Report (draft)'}</Button>}
        <ReportPdfButton job={job} />
        {!job.reportIssuedAt && ['COMPLETED', 'UNABLE_TO_ACCESS', 'CANCELLED', 'CLOSED'].includes(job.status) && <Button title="Give the report a number, lock the charges and invoice the extras (7-day terms)" icon={Receipt} onClick={() => act(job, 'report', {}, 'Report issued and extras invoiced.')}>Issue report</Button>}
      </>}>
      <TriagePanel job={job} act={act} config={config} />
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
              <TriageBadge triage={job.triage} />
              <Badge>{job.affectedArea ? `${job.affectedArea} m² reported` : 'Area not given'}</Badge>
              {job.measuredArea != null && <Badge tone="brand">{job.measuredArea} m² measured</Badge>}
              {job.waterType && <Badge tone={['GREY', 'BLACK'].includes(job.waterType) ? 'danger' : 'slate'}>{WATER_TYPES.find(w => w.id === job.waterType)?.label}</Badge>}
              {(job.hazards || []).map(h => <Badge key={h} tone="danger">{HAZARDS.find(x => x.id === h)?.label || h}</Badge>)}
              <Badge tone={job.isOngoing ? 'warning' : 'slate'}>{job.isOngoing ? 'Still ongoing' : 'Contained'}</Badge>
              <Badge tone={job.isSafeToAccess === false ? 'danger' : 'success'}>{job.isSafeToAccess === false ? 'Hazards reported' : 'Safe to access'}</Badge>
              <Badge>Incident time: {formatDateTime(job.incidentTime)}</Badge>
            </div>
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{job.description}</p>
            {(job.coverageWarnings || []).length > 0 && (
              <ul className="mt-3 list-disc space-y-1 rounded-xl border border-amber-200 bg-amber-50 py-2 pl-8 pr-3 text-sm text-amber-900">{job.coverageWarnings.map(w => <li key={w}>{w}</li>)}</ul>
            )}
            {job.reclassifyReason && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Reclassified on site:</b> {job.reclassifyReason}</p>}
          </Card>
          <EligibilityCard job={job} org={org} config={config} />
          <ChargesCard job={job} act={act} config={config} />
          <Card title="Photos & videos" icon={Camera}><MediaStrip job={job} /></Card>
          <Card title="Progress" icon={Clock}><SlaTimeline job={job} /></Card>
        </div>

        <div className="order-1 space-y-4 xl:order-2">
          {!readyToDispatch && !isFinished(job.status) && !current && (
            <Card tone="warning" title="Triage before dispatch" icon={AlertTriangle}>
              <p className="text-sm text-amber-900">Acknowledge the request and mark it covered (A) before sending a technician. Assigning now marks it covered automatically.</p>
            </Card>
          )}
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
                <Button title="Go back to the job queue" block icon={ArrowLeft} to="/admin/dispatch">Back to dispatch list</Button>
                {nextUnassigned && <Button title="Open the next job that still needs a technician" block variant="secondary" to={`/admin/jobs/${nextUnassigned.id}`}>Next unassigned job ({nextUnassigned.jobNumber})</Button>}
                {!isFinished(job.status) && <Button title="Pick a different technician or change the job status" block variant="ghost" icon={RefreshCw} onClick={() => { setPicking(true); setJustAssigned(null); }}>Change technician or status</Button>}
              </div>
            </Card>
          ) : (
            <Card title={current ? 'Change technician' : 'Assign technician'} icon={Users}
              actions={current && <Button title="Keep the current technician" size="sm" variant="ghost" onClick={() => { setPicking(false); setTech(null); setStatus(null); }}>Cancel</Button>}>
              {isFinished(job.status) ? <p className="text-sm text-slate-500">This job is finished.</p> : (
                <>
                  <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {sorted.map(t => (
                      <li key={t.id}>
                        <button title="Choose this technician" type="button" onClick={() => setTech(t.name)} className={cx('flex w-full items-center gap-2 rounded-xl border-2 p-2 text-left cursor-pointer', chosenTech === t.name ? 'border-brand bg-sky-50' : 'border-slate-200 hover:border-slate-300')}>
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
                  <Button title="Save the technician and status. The technician is told straight away." block className="mt-3" disabled={busy || !chosenTech || unchanged} onClick={assign} icon={CheckCircle2}>
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
                  <button title="Show this job on the map" onClick={() => setParams({ job: j.id })} className={cx('w-full rounded-xl border-2 p-2.5 text-left cursor-pointer', selected?.id === j.id ? 'border-brand bg-sky-50' : 'border-slate-200 hover:border-slate-300')}>
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
                  <Button title="Call the technician" size="sm" variant="success" icon={Phone} href={`tel:${tech?.phone || ''}`}>Call</Button>
                  <Button title="Open the job" size="sm" variant="secondary" onClick={() => navigate(`/admin/jobs/${selected.id}`)}>Job</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}

// Triage (Operations SOP): A covered, B specialist (quote), C excluded, D grey area (manager decides within 15 minutes)
function TriagePanel({ job, act, config }) {
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState(job.quoteAmount ? String(job.quoteAmount) : '');
  if (isFinished(job.status) && job.status !== 'DECLINED') return null;
  const greyDeadline = job.triage === 'GREY_AREA' && job.triagedAt ? new Date(new Date(job.triagedAt).getTime() + (config.greyAreaDecisionMinutes ?? 15) * 60000) : null;
  const send = (outcome) => act(job, 'triage', { outcome, notes, quoteAmount: outcome === 'SPECIALIST' ? quote : undefined }, `Triage: ${TRIAGE[outcome].label}`);
  return (
    <Card title="Triage" icon={ListChecks} className="mb-4"
      actions={<span className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><TriageBadge triage={job.triage} />{job.acknowledgedAt ? `Acknowledged ${formatDateTime(job.acknowledgedAt)} · target ${targetText(job)}` : 'Not acknowledged yet'}</span>}>
      {greyDeadline && <p className="mb-2 text-sm font-semibold text-indigo-700">Grey area: manager to decide by {greyDeadline.toLocaleTimeString('en-AU', { timeZone: 'Australia/Adelaide', hour: 'numeric', minute: '2-digit' })}.</p>}
      {job.quoteStatus && <p className="mb-2 text-sm text-slate-700">Quote {fmtMoney(job.quoteAmount || 0)} + GST: <b>{job.quoteStatus.toLowerCase()}</b></p>}
      <div className="grid gap-2 md:grid-cols-[1fr_160px]">
        <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for the record (what was checked, who decided)" />
        <input className={inputCls} value={quote} onChange={e => setQuote(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Quote $ (for B)" inputMode="decimal" />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(TRIAGE).map(([key, t]) => (
          <button key={key} type="button" title={t.hint} onClick={() => send(key)}
            className={cx('rounded-xl border-2 p-2.5 text-left text-sm cursor-pointer', job.triage === key ? 'border-brand bg-sky-50' : 'border-slate-200 hover:border-slate-300')}>
            <div className="font-bold text-slate-900">{t.label}</div><div className="text-xs text-slate-500">{t.hint}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

// Eligibility checks before dispatch (Operations SOP)
function EligibilityCard({ job, org, config }) {
  if (!org) return null;
  const m = org.membership || {};
  const site = (m.sites || []).find(x => x.id === job.locationId);
  const plan = (config.membershipPlans || []).find(p => p.id === job.planAtBooking) || (config.membershipPlans || []).find(p => p.id === org.membershipPlan);
  const at = new Date(job.acknowledgedAt || job.submittedAt);
  const sur = plan ? surchargeFor(plan, at, config) : { amount: 0 };
  const rows = [
    ['Membership active and paid', org.subscriptionStatus === 'ACTIVE', org.subscriptionStatus === 'SUSPENDED' ? 'Suspended: payment overdue (charge as additional call-out)' : org.subscriptionStatus],
    ['Past the 10-day waiting period', !inWaitingPeriod(org.activationDate, job.submittedAt, config), `Day ${m.membershipDay ?? '?'} of membership${inWaitingPeriod(org.activationDate, job.submittedAt, config) ? `: ${fmtMoney(config.earlyActivationFee)} early activation fee` : ''}`],
    ['Included call-outs left at this site', !site || site.remaining > 0 || job.calloutType === 'INCLUDED', site ? `${site.remaining} of ${site.included} left${site.remaining <= 0 ? `: extra call-out ${fmtMoney(m.additionalCalloutFee)}` : ''}` : ''],
    ['Inside the service window', !plan || insideServiceWindow(plan, at), plan ? `${plan.name}: ${plan.window ? '6am–9pm' : '24/7'}` : ''],
    ['Surcharge quoted to the member', sur.amount === 0, sur.amount ? `${sur.reason}: ${fmtMoney(sur.amount)} + GST` : 'None'],
    ['Site in the Adelaide metro area', !site || site.serviceArea === 'METRO', site?.serviceArea === 'METRO' ? 'Metro' : `Outside metro${site?.areaApproved ? ' (approved)' : ' (NOT approved yet)'}${site?.travelKm ? `, ${site.travelKm} km` : ', distance not set'}`],
    ['Photos received', (job.photos || []).length > 0, (job.photos || []).length ? `${job.photos.length} photo(s)` : `Chase after ${config.photoChaseMinutes ?? 10} minutes`]
  ];
  return (
    <Card title="Eligibility checks" icon={ClipboardCheck}>
      <ul className="space-y-1.5 text-sm">
        {rows.map(([label, ok, note]) => (
          <li key={label} className="flex items-start gap-2">
            {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
            <span><span className="font-semibold text-slate-800">{label}</span>{note ? <span className="text-slate-500"> · {note}</span> : null}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Charges so far, plus the admin-only extras (travel distance and other charges), and the goodwill credit
function ChargesCard({ job, act, config }) {
  const [travel, setTravel] = useState(job.travelKm != null ? String(job.travelKm) : '');
  const [other, setOther] = useState(job.otherCharges ? String(job.otherCharges) : '');
  const [otherNote, setOtherNote] = useState(job.otherChargesNote || '');
  const late = Boolean(job.targetAttendanceAt && job.arrivedAt && new Date(job.arrivedAt) > new Date(job.targetAttendanceAt));
  return (
    <Card title="Charges (ex GST)" icon={Receipt}
      actions={job.targetAttendanceAt && !job.goodwillCredited && late && <Button size="sm" variant="ghost" icon={Gift} title={`Credit ${config.goodwillPoints} points if SACC arrived more than 4 hours late for reasons within its control`} onClick={() => act(job, 'goodwill', {}, 'Goodwill points credited.')}>Late: credit {config.goodwillPoints} pts</Button>}>
      <ChargesTable charges={job.charges} />
      {!job.reportIssuedAt && (
        <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-[120px_120px_1fr_auto]">
          <input className={inputCls} value={travel} onChange={e => setTravel(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Travel km" title="Kilometres one way from the Adelaide GPO (outside metro only)" inputMode="decimal" />
          <input className={inputCls} value={other} onChange={e => setOther(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Other $" inputMode="decimal" />
          <input className={inputCls} value={otherNote} onChange={e => setOtherNote(e.target.value)} placeholder="What the other charge is for" />
          <Button variant="secondary" onClick={() => act(job, 'site', { travelKm: travel, otherCharges: other || 0, otherChargesNote: otherNote }, 'Charges updated.')}>Save</Button>
        </div>
      )}
      {job.reportIssuedAt && <p className="mt-2 text-xs text-slate-500">Locked when report {job.reportNumber} was issued on {fmtDate(job.reportIssuedAt)}.</p>}
    </Card>
  );
}

// Things the SOP and Agreement give SACC a deadline for, from GET /analytics/summary
function AttentionStrip({ jobs }) {
  const [a, setA] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/analytics/summary`).then(r => (r.ok ? r.json() : null)).then(d => { if (alive) setA(d?.attention || null); }).catch(() => {});
    return () => { alive = false; };
  }, [jobs]);
  if (!a) return null;
  const items = [
    ...a.greyArea.map(j => ({ key: `g${j.id}`, tone: 'danger', text: `${j.jobNumber}: grey-area decision overdue`, to: `/admin/jobs/${j.id}` })),
    ...a.reportsDue.map(j => ({ key: `r${j.id}`, tone: 'warning', text: `${j.jobNumber}: service report due (24 h)`, to: `/admin/jobs/${j.id}` })),
    ...a.goodwillDue.map(j => ({ key: `w${j.id}`, tone: 'warning', text: `${j.jobNumber}: arrived late, check the 50-point credit`, to: `/admin/jobs/${j.id}` })),
    ...a.awaitingQuote.map(j => ({ key: `q${j.id}`, tone: 'slate', text: `${j.jobNumber}: waiting for the member to accept the quote`, to: `/admin/jobs/${j.id}` })),
    ...a.outsideMetroSites.map(l => ({ key: `l${l.id}`, tone: 'indigo', text: `${l.name}: outside metro, approve the site`, to: `/admin/customers/${l.organizationId}?tab=sites` })),
    ...a.suspended.map(o => ({ key: `s${o.id}`, tone: 'danger', text: `${o.businessName}: suspended (payment overdue)`, to: `/admin/customers/${o.id}` })),
    ...a.cancellationReview.map(o => ({ key: `c${o.id}`, tone: 'danger', text: `${o.businessName}: unpaid 30 days, review for cancellation`, to: `/admin/customers/${o.id}` })),
    ...(a.overdueInvoices ? [{ key: 'inv', tone: 'warning', text: `${a.overdueInvoices} overdue invoice(s)`, to: '/admin/customers' }] : [])
  ];
  if (!items.length) return null;
  return (
    <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
      <span className="flex items-center gap-1 text-xs font-bold uppercase text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />Needs attention</span>
      {items.slice(0, 8).map(i => <Link key={i.key} to={i.to} className="hover:opacity-80"><Badge tone={i.tone}>{i.text}</Badge></Link>)}
      {items.length > 8 && <span className="text-xs text-amber-800">+{items.length - 8} more</span>}
    </div>
  );
}
