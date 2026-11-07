import { Preferences } from '@capacitor/preferences';
import { API_BASE } from '@/shared/config/env.js';

// The service report is built once, on the server, in the layout of the client's Service Report Template.
// The tab cannot send the Authorization header, so the current access token is passed in the URL.
const reportUrl = async (jobId, print) => {
  const { value: accessToken } = await Preferences.get({ key: 'sacc_access_token' });
  return `${API_BASE}/jobs/${jobId}/pdf-report?token=${encodeURIComponent(accessToken || '')}${print ? '&download=true' : ''}`;
};

export const openPrintableReport = async (jobId) => {
  window.open(await reportUrl(jobId, false), '_blank');
};

// Opens the report with the print dialog, where "Save as PDF" gives the PDF
export const handleDownloadPdfReport = async (jobId) => {
  window.open(await reportUrl(jobId, true), '_blank');
};
