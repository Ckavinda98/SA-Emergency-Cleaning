// W5 Request detail and live tracking: map, technician, 7-stage timeline, details and media on one page
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Edit3, FileText, Phone, MapPin, Maximize2, Minimize2, User, ShieldAlert, Camera, Receipt, XCircle, Wrench, AlertTriangle } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { useJobAction } from '@/app/useJobAction.js';
import { ReportPdfButton } from '@/reports/ReportPdfButton.jsx';
import { Page, Card, Button, Badge, InfoRow, EmptyState, Alert, InlineConfirm, Field, inputCls, cx } from '@/shared/ui/index.jsx';
import { StatusChip, SlaTimeline, MapEmbed, MediaStrip, isLive, isNewJob, hasTech, formatDateTime, ChargesTable, TriageBadge, targetText } from '@/shared/ui/jobs.jsx';
import { HotlineLink, fmtMoney } from '@/shared/ui/membership.jsx';
import { WATER_TYPES, HAZARDS } from '@shared/membership.js';
import { DISPATCHED_STATUSES, FINISHED_STATUSES } from '@shared/jobStatus.js';

export function RequestDetailPage() {
  const { jobId } = useParams();
  const { jobs, loaded, config } = useAppData();
  const job = jobs.find(j => j.id === jobId || j.jobNumber === jobId);
  const [mapFull, setMapFull] = useState(false);
  const [problem, setProblem] = useState('');
  const act = useJobAction();

  if (!job) {
    return <Page breadcrumb={[{ label: 'Requests', to: '/app/requests' }, { label: 'Not found' }]}>
      <Card><EmptyState title={loaded ? 'Request not found' : 'Loading…'} action={<Button to="/app/requests" variant="secondary">Back to requests</Button>} /></Card>
    </Page>;
  }

  const live = isLive(job.status);
  const dispatched = DISPATCHED_STATUSES.includes(job.status) || (hasTech(job) && !FINISHED_STATUSES.includes(job.status));
  const canCancel = !FINISHED_STATUSES.includes(job.status) && !['IN_PROGRESS', 'UNABLE_TO_ACCESS', 'CONVERTED_TO_QUOTE'].includes(job.status);
  const hoursSinceDone = job.completedAt ? (Date.now() - new Date(job.completedAt)) / 3600000 : null;
  const canReport = hoursSinceDone != null && hoursSinceDone <= (config.workmanshipNoticeHours ?? 24) && !jobs.some(j => j.reattendOfId === job.id);
  const editable = isNewJob(job.status) && !job.acknowledgedAt;
  return (
    <Page
      fit
      title={`${job.category} emergency`}
      subtitle={`${job.locationName || 'Site'} · ${job.address || ''}`}
      breadcrumb={[{ label: 'Requests', to: '/app/requests' }, { label: job.jobNumber || 'Request' }]}
      actions={<>
        <StatusChip status={job.status} />
        {editable && <Button title="Change the details until SACC acknowledges the request" to={`/app/requests/${job.id}/edit`} variant="secondary" icon={Edit3}>Edit request</Button>}
        {canCancel && <InlineConfirm label="Cancel request" icon={XCircle} title="Cancel this request"
          message={dispatched ? `A technician is on the way: the call-out is used and a ${fmtMoney(config.lateCancellationFee)} + GST fee applies.` : 'No fee: nobody has been sent yet.'}
          confirmLabel="Yes, cancel" onConfirm={() => act(job, 'cancel', {}, 'Request cancelled.')} />}
        {hasTech(job) && live && <Button title="Call the technician on their phone" href={`tel:${job.technicianPhone || job.onsitePhone || ''}`} variant="success" icon={Phone}>Call technician</Button>}
        {job.reportIssuedAt && <Button title="Open the service report for this job" to={`/app/requests/${job.id}/report`} icon={FileText}>Service report {job.reportNumber}</Button>}
        <ReportPdfButton job={job} />
      </>}
    >
      {job.quoteStatus === 'PENDING' && (
        <Card tone="warning" title="This job is outside membership cover" icon={AlertTriangle} className="mb-4">
          <p className="text-sm text-amber-900">{job.reclassifyReason || job.triageNotes || 'SACC has assessed this as a specialist service, quoted separately.'} No call-out is used{job.quoteAmount ? `. Quote: ${fmtMoney(job.quoteAmount)} + GST.` : '. SACC will send you the price.'}</p>
          {job.quoteAmount ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <InlineConfirm label="Accept quote" variant="primary" confirmVariant="success" message={`Go ahead at ${fmtMoney(job.quoteAmount)} + GST?`} confirmLabel="Accept" onConfirm={() => act(job, 'quote', { decision: 'ACCEPTED' }, 'Quote accepted. SACC will go ahead.')} />
              <InlineConfirm label="Decline quote" message="No work is done and no call-out is used." confirmLabel="Decline" onConfirm={() => act(job, 'quote', { decision: 'DECLINED' }, 'Quote declined.')} />
            </div>
          ) : null}
        </Card>
      )}
      {job.status === 'UNABLE_TO_ACCESS' && <Alert tone="danger" className="mb-4">The technician could not get into the site. The call-out was used and a {fmtMoney(config.missedAccessFee)} + GST attendance fee applies (cl. 12.4).</Alert>}
      {job.status === 'ARRIVED' && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
          <MapPin className="h-5 w-5 shrink-0" /><span><strong>{job.technicianName}</strong> has arrived at {job.locationName || 'your site'} and is getting ready to start.</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr] fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <div className={cx('flex min-h-0 flex-col gap-4', mapFull && 'lg:col-span-2')}>
          <Card
            title={live ? 'Live technician location' : 'Site location'}
            icon={MapPin}
            className="min-h-[260px] fit:flex-1"
            bodyClassName="flex-1 flex flex-col"
            actions={<Button title="Make the map bigger or smaller" variant="ghost" size="sm" icon={mapFull ? Minimize2 : Maximize2} onClick={() => setMapFull(f => !f)} className="hidden lg:inline-flex">{mapFull ? 'Smaller' : 'Full width'}</Button>}
          >
            <MapEmbed address={job.address} interactive className="min-h-[220px] flex-1" />
          </Card>
          <Card padded className="shrink-0">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-50"><User className="h-5 w-5 text-brand" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase text-slate-500">Technician</div>
                <div className="text-sm font-bold text-slate-900">{hasTech(job) ? job.technicianName : 'Not assigned yet'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Target arrival</div>
                <div className="text-sm font-bold text-brand">{targetText(job)}</div>
              </div>
              {job.status === 'TRAVELLING' && <Badge tone="indigo">On the way</Badge>}
            </div>
          </Card>
        </div>

        {!mapFull && (
          <div className="flex min-h-0 flex-col gap-4 fit:overflow-y-auto fit:pr-1">
            <Card title="Progress" icon={ShieldAlert} className="shrink-0">
              <SlaTimeline job={job} />
            </Card>
            <Card title="Incident details" className="shrink-0">
              <dl className="grid grid-cols-2 gap-3">
                <InfoRow label="Job number">{job.jobNumber}</InfoRow>
                <InfoRow label="Submitted">{formatDateTime(job.submittedAt || job.createdAt)}</InfoRow>
                <InfoRow label="Affected area">{job.measuredArea != null ? `${job.measuredArea} m² (measured)` : job.affectedArea ? `${job.affectedArea} m²` : ''}</InfoRow>
                <InfoRow label="Water">{WATER_TYPES.find(w => w.id === job.waterType)?.label}</InfoRow>
                <InfoRow label="Hazards">{(job.hazards || []).map(h => HAZARDS.find(x => x.id === h)?.label || h).join(', ') || 'None'}</InfoRow>
                <InfoRow label="SACC assessment"><TriageBadge triage={job.triage} /></InfoRow>
                <InfoRow label="Still ongoing">{job.isOngoing ? 'Yes' : 'No'}</InfoRow>
                <InfoRow label="Safe to access">{job.isSafeToAccess === false ? 'No, hazards present' : 'Yes'}</InfoRow>
                <InfoRow label="On-site contact">{job.onsiteContact}{job.onsitePhone ? ` · ${job.onsitePhone}` : ''}</InfoRow>
              </dl>
              {job.description && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{job.description}</p>}
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <InfoRow label="Access">{job.accessInstructions}</InfoRow>
                <InfoRow label="Restrictions">{job.accessRestrictions}</InfoRow>
                <InfoRow label="Parking / security">{job.parkingInstructions}</InfoRow>
              </dl>
            </Card>
            <Card title="Photos & videos" icon={Camera} className="shrink-0">
              <MediaStrip job={job} />
            </Card>
            <Card title="Charges for this visit" icon={Receipt} className="shrink-0">
              <ChargesTable charges={job.charges} />
              <p className="mt-2 text-xs text-slate-500">{job.reportIssuedAt ? 'Invoiced with the service report, due within 7 days.' : 'Estimate so far. Final charges are on the service report.'}</p>
            </Card>
            {canReport && (
              <Card title="Not happy with the clean?" icon={Wrench} className="shrink-0">
                <p className="text-sm text-slate-600">Tell us within 24 hours of completion and we will come back and fix it at no cost (workmanship guarantee).</p>
                <Field label="What was not right?" className="mt-2"><textarea rows={2} className={inputCls} value={problem} onChange={e => setProblem(e.target.value)} /></Field>
                <Button className="mt-2" variant="secondary" disabled={problem.trim().length < 5} onClick={async () => { if (await act(job, 'reattend', { description: problem }, 'Re-attend booked. SACC will call you.')) setProblem(''); }}>Ask SACC to come back</Button>
              </Card>
            )}
            <p className="text-xs text-slate-500">Urgent change? Call the 24/7 hotline <HotlineLink /></p>
          </div>
        )}
      </div>
    </Page>
  );
}
