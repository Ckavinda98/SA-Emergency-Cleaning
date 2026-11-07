// W23 Service completion report shown inside the app with Download / Print actions
// (used at /app/requests/:id/report, /tech/jobs/:id/report and /admin/jobs/:id/report)
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Download, Printer, ExternalLink } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Button, EmptyState } from '@/shared/ui/index.jsx';
import { handleDownloadPdfReport, openPrintableReport } from '@/reports/serviceReport.js';

export function ServiceReportPage() {
  const { jobId } = useParams();
  const { pathname } = useLocation();
  const { jobs } = useAppData();
  const job = jobs.find(j => j.id === jobId);
  const [src, setSrc] = useState('');
  const frame = useRef(null);

  useEffect(() => {
    Preferences.get({ key: 'sacc_access_token' }).then(({ value }) =>
      setSrc(`${API_BASE}/jobs/${jobId}/pdf-report?token=${encodeURIComponent(value || '')}`));
  }, [jobId]);

  const base = pathname.replace(/\/report$/, '');
  const area = pathname.startsWith('/admin') ? { label: 'Dispatch', to: '/admin/dispatch' } : pathname.startsWith('/tech') ? { label: 'My jobs', to: '/tech/jobs' } : { label: 'Requests', to: '/app/requests' };

  const print = () => {
    try { frame.current?.contentWindow?.print(); } catch { openPrintableReport(jobId); }
  };

  return (
    <Page fit title="Service completion report" subtitle={job ? `${job.jobNumber} · ${job.customerName}` : undefined}
      breadcrumb={[area, { label: job?.jobNumber || 'Job', to: base }, { label: 'Report' }]}
      actions={<>
        <Button icon={Download} onClick={() => handleDownloadPdfReport(jobId, job?.jobNumber)}>Download</Button>
        <Button variant="secondary" icon={Printer} onClick={print}>Print</Button>
        <Button variant="ghost" icon={ExternalLink} onClick={() => openPrintableReport(jobId)}>Open in new tab</Button>
      </>}>
      <Card padded={false} className="min-h-[70vh] overflow-hidden fit:min-h-0 fit:flex-1" bodyClassName="flex-1 flex">
        {src ? <iframe ref={frame} title="Service report" src={src} className="min-h-[70vh] w-full flex-1 border-0 bg-white fit:min-h-0" /> : <EmptyState title="Loading report…" />}
      </Card>
    </Page>
  );
}
