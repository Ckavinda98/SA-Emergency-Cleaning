// W5 Request detail and live tracking: map, technician, 7-stage timeline, details and media on one page
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Edit3, FileText, Phone, MapPin, Maximize2, Minimize2, User, ShieldAlert, Camera } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { Page, Card, Button, Badge, InfoRow, EmptyState, cx } from '@/shared/ui/index.jsx';
import { StatusChip, SlaTimeline, MapEmbed, MediaStrip, isCompleted, isLive, isNewJob, hasTech, formatDateTime } from '@/shared/ui/jobs.jsx';

export function RequestDetailPage() {
  const { jobId } = useParams();
  const { jobs, loaded } = useAppData();
  const job = jobs.find(j => j.id === jobId || j.jobNumber === jobId);
  const [mapFull, setMapFull] = useState(false);

  if (!job) {
    return <Page breadcrumb={[{ label: 'Requests', to: '/app/requests' }, { label: 'Not found' }]}>
      <Card><EmptyState title={loaded ? 'Request not found' : 'Loading…'} action={<Button to="/app/requests" variant="secondary">Back to requests</Button>} /></Card>
    </Page>;
  }

  const live = isLive(job.status);
  return (
    <Page
      fit
      title={`${job.category} emergency`}
      subtitle={`${job.locationName || 'Site'} · ${job.address || ''}`}
      breadcrumb={[{ label: 'Requests', to: '/app/requests' }, { label: job.jobNumber || 'Request' }]}
      actions={<>
        <StatusChip status={job.status} />
        {isNewJob(job.status) && <Button title="Change the details while the request is still new" to={`/app/requests/${job.id}/edit`} variant="secondary" icon={Edit3}>Edit request</Button>}
        {hasTech(job) && live && <Button title="Call the technician on their phone" href={`tel:${job.technicianPhone || job.onsitePhone || ''}`} variant="success" icon={Phone}>Call technician</Button>}
        {isCompleted(job.status) && <Button title="Open the service report for this job" to={`/app/requests/${job.id}/report`} icon={FileText}>Service report</Button>}
      </>}
    >
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
                <div className="text-xs font-semibold uppercase text-slate-500">Target attendance</div>
                <div className="text-sm font-bold text-brand">Within 2–4 hours</div>
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
                <InfoRow label="Affected area">{job.affectedArea ? `${job.affectedArea} m²` : ''}</InfoRow>
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
          </div>
        )}
      </div>
    </Page>
  );
}
