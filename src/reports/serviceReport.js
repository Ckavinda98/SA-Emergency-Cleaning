import { Preferences } from '@capacitor/preferences';
import { API_BASE } from '@/shared/config/env.js';

// The service report is built on the server. The HTML view mirrors the client's template; the PDF is
// the client's template file itself, filled in. A new tab cannot send the Authorization header, so the
// current access token is passed in the URL.
const token = async () => (await Preferences.get({ key: 'sacc_access_token' })).value || '';
const reportUrl = async (jobId, print) => `${API_BASE}/jobs/${jobId}/pdf-report?token=${encodeURIComponent(await token())}${print ? '&download=true' : ''}`;
export const reportPdfUrl = async (jobId, inline = false) => `${API_BASE}/jobs/${jobId}/report.pdf?token=${encodeURIComponent(await token())}${inline ? '&inline=true' : ''}`;

// A report exists once the technician has finished (or recorded missed access)
export const REPORT_STATUSES = ['COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'UNABLE_TO_ACCESS'];
export const hasReport = (job) => Boolean(job && (job.reportIssuedAt || REPORT_STATUSES.includes(job.status)));

export const openPrintableReport = async (jobId) => {
  window.open(await reportUrl(jobId, false), '_blank');
};

// Downloads the filled-in Emergency Service Report template as a PDF file
export const downloadReportPdf = async (jobId, fileName) => {
  const url = await reportPdfUrl(jobId);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName || jobId}-service-report.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return true;
  } catch {
    // Phones (and blocked downloads): open the PDF itself
    window.open(url, '_blank');
    return false;
  }
};

// Kept for older callers: now gives the PDF file
export const handleDownloadPdfReport = (jobId, jobNumber) => downloadReportPdf(jobId, jobNumber);
