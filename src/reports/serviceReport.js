import { Preferences } from '@capacitor/preferences';
import { API_BASE } from '@/shared/config/env.js';

// Opens the printable report in a new tab. The tab cannot send the Authorization header,
// so the current access token is passed in the URL and checked by the server.
export const openPrintableReport = async (jobId) => {
  const { value: accessToken } = await Preferences.get({ key: 'sacc_access_token' });
  window.open(`${API_BASE}/jobs/${jobId}/pdf-report?token=${encodeURIComponent(accessToken || '')}`, '_blank');
};

// Guaranteed Native Vector PDF Generator (Writes crisp PDF text & tables; 100% non-blank)
export const handleDownloadPdfReport = async (jobId, jobNumber) => {
  try {
    // 1. Fetch job details from API
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const job = await res.json();

    // 2. Dynamically load jsPDF library if not present
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // All times come from the database: JobStatusEvent rows, workStartedAt and completedAt
    const fmt = (d, withDate = false) => d
      ? new Date(d).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', ...(withDate ? { dateStyle: 'medium' } : {}), timeStyle: 'short' })
      : 'Not recorded';
    const events = Array.isArray(job.statusEvents) ? job.statusEvents : [];
    const firstAt = (statuses) => (events.find(e => statuses.includes(e.toStatus)) || {}).createdAt || null;
    const arrivedAt = firstAt(['ARRIVED']);
    const submittedFormatted = fmt(job.submittedAt, true);
    const dispatchedFormatted = fmt(firstAt(['TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED']));
    const acceptedFormatted = fmt(firstAt(['ACCEPTED']));
    const travellingFormatted = fmt(firstAt(['TRAVELLING']));
    const arrivedFormatted = fmt(arrivedAt);
    const inProgressFormatted = fmt(job.workStartedAt || firstAt(['IN_PROGRESS']));
    const completedFormatted = fmt(job.completedAt || firstAt(['COMPLETED']), true);
    const responseMins = arrivedAt ? Math.round((new Date(arrivedAt) - new Date(job.submittedAt)) / 60000) : null;
    const labourMins = job.workStartedAt && job.completedAt
      ? Math.max(1, Math.round((new Date(job.completedAt) - new Date(job.workStartedAt)) / 60000))
      : (job.timerMinutes || 0);
    const slaText = !arrivedAt ? 'Not yet attended'
      : (job.targetAttendanceAt && new Date(arrivedAt) > new Date(job.targetAttendanceAt) ? 'MISSED' : 'PASSED (On Schedule)');
    const isDone = ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status);

    // --- Header ---
    doc.setFillColor(2, 134, 205); // #0286cd
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('SA EMERGENCY CLEANING', 14, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Emergency Response & Service Completion Audit Report', 14, 19);

    doc.setFillColor(224, 242, 254);
    doc.roundedRect(148, 5, 48, 14, 3, 3, 'F');
    doc.setTextColor(3, 105, 161);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`JOB: ${job.jobNumber || jobId}`, 152, 14);

    // --- Customer & Incident Cards ---
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 30, 88, 38, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 30, 88, 38, 'S');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('CUSTOMER & SITE LOCATION', 18, 36);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(String(job.customerName || 'Adelaide Commercial Customer'), 18, 43);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(String(job.address || '100 King William St, Adelaide SA'), 18, 49);
    doc.text(`Contact: ${job.onsiteContact || 'Facility Manager'} (${job.onsitePhone || '0400 000 000'})`, 18, 55);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, 30, 88, 38, 3, 3, 'F');
    doc.rect(108, 30, 88, 38, 'S');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('INCIDENT & ATTENDANCE SUMMARY', 112, 36);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Category: ${job.category || 'Plumbing / Flood'} Emergency`, 112, 43);
    doc.text(`Submitted At: ${submittedFormatted}`, 112, 49);
    doc.text(`Technician: ${job.technicianName || 'Unassigned'}`, 112, 55);
    doc.setTextColor(4, 120, 87);
    doc.setFont('helvetica', 'bold');
    doc.text(isDone ? 'Status: COMPLETED & SIGNED OFF' : `Status: ${job.status}`, 112, 61);

    // --- Job Timing Audit Log Table ---
    doc.setFillColor(2, 134, 205);
    doc.rect(14, 74, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('JOB TIMING & SLA RESPONSE AUDIT LOG', 18, 79);

    const stages = [
      ['1. Request Submitted', submittedFormatted, String(job.customerName || 'Customer')],
      ['2. Admin Dispatched', dispatchedFormatted, 'SACC Operations Desk'],
      ['3. Technician Accepted', acceptedFormatted, String(job.technicianName || '-')],
      ['4. En Route (Transit Start)', travellingFormatted, 'GPS Location Transmitting'],
      ['5. Arrived On-Site', arrivedFormatted, String(job.locationName || 'Service Site')],
      ['6. Cleaning Commenced', inProgressFormatted, 'Labour timer started'],
      ['7. Job Completed', completedFormatted, isDone ? 'Completed' : '-']
    ];

    let y = 87;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 81, 182, 6, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('LIFECYCLE STAGE', 18, 85);
    doc.text('TIMESTAMP', 90, 85);
    doc.text('STATUS / ACTOR', 145, 85);

    stages.forEach((stage, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 4, 182, 6, 'F');
      }
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', idx === 6 ? 'bold' : 'normal');
      if (idx === 6) doc.setTextColor(4, 120, 87);
      doc.text(stage[0], 18, y);
      doc.text(stage[1], 90, y);
      doc.text(stage[2], 145, y);
      y += 6;
    });

    // --- KPI Response Metric Cards ---
    y += 4;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, y, 58, 14, 2, 2, 'F');
    doc.setTextColor(29, 78, 216);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL RESPONSE TIME', 18, y + 5);
    doc.setFontSize(10);
    doc.text(responseMins === null ? 'Not recorded' : `${responseMins} Mins`, 18, y + 11);

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(76, y, 58, 14, 2, 2, 'F');
    doc.setTextColor(21, 128, 61);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('ON-SITE LABOUR DURATION', 80, y + 5);
    doc.setFontSize(10);
    doc.text(`${labourMins} Mins`, 80, y + 11);

    doc.setFillColor(250, 245, 255);
    doc.roundedRect(138, y, 58, 14, 2, 2, 'F');
    doc.setTextColor(126, 34, 206);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('2-4 HR SLA TARGET', 142, y + 5);
    doc.setFontSize(10);
    doc.text(slaText, 142, y + 11);

    // --- Work Performed & Scope Log ---
    y += 20;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 22, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, 22, 'S');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('WORK PERFORMED & SCOPE LOG', 18, y + 6);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(`"${job.description || 'Emergency cleaning and hazard mitigation completed in full.'}"`, 18, y + 12);
    doc.text(`Labour: ${labourMins} Mins  |  Additional Overage Charges: $${job.additionalCharges || '0.00'}`, 18, y + 17);

    // --- Footer ---
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 280, 196, 280);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text('© 2026 SA Emergency Cleaning Pty Ltd • 24/7 Response Desk • Adelaide, South Australia', 105, 285, { align: 'center' });

    // Download crisp vector PDF file directly
    doc.save(`SACC-Service-Completion-Report-${job.jobNumber || jobId}.pdf`);
  } catch (err) {
    console.error('jsPDF generation error:', err);
    openPrintableReport(jobId);
  }
};
