// "Service report (PDF)" download button, shown to every user type once a job is finished
import React, { useState } from 'react';
import { FileDown } from 'lucide-react';
import { Button } from '@/shared/ui/index.jsx';
import { downloadReportPdf, hasReport } from './serviceReport.js';

export function ReportPdfButton({ job, size, variant = 'secondary', label = 'Report PDF', className, iconOnly = false }) {
  const [busy, setBusy] = useState(false);
  if (!hasReport(job)) return null;
  const go = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setBusy(true);
    await downloadReportPdf(job.id, job.reportNumber || job.jobNumber);
    setBusy(false);
  };
  if (iconOnly) {
    return (
      // A span, so it can sit inside a clickable row or card without nesting buttons
      <span role="button" tabIndex={0} onClick={busy ? undefined : go}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } }}
        title={`Download the service report PDF for ${job.jobNumber}`}
        className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-brand hover:bg-sky-50 ${busy ? 'opacity-50' : ''}`}>
        <FileDown className="h-4 w-4" />
      </span>
    );
  }
  return (
    <Button size={size} variant={variant} icon={FileDown} disabled={busy} onClick={go} className={className}
      title="Download the Emergency Service Report, filled in from this job, as a PDF">{busy ? 'Preparing…' : label}</Button>
  );
}
