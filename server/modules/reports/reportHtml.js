// HTML for the printable service report. Every value shown comes from the database.
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

export function renderServiceReport({
  job, photos, download, submittedFormatted, completedFormatted, timelineRows,
  responseTimeMinutes, labourDurationMinutes, slaStatus, isCompleted
}) {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SACC Service Completion Report - ${job.jobNumber}</title>
        <style>
          @media print {
            .no-print { display: none !important; }
            body { margin: 0 !important; padding: 15px !important; }
          }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; background: #f8fafc; }
          .container { max-width: 900px; margin: 0 auto; background: white; padding: 35px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0286cd; padding-bottom: 20px; }
          .logo-title { font-size: 22px; font-weight: 900; color: #0286cd; }
          .badge { background: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 800; border: 1px solid #bae6fd; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 25px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 12px; font-size: 13px; }
          .card h4 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
          .photos { display: flex; gap: 15px; margin-top: 20px; flex-wrap: wrap; }
          .photos img { width: 150px; height: 150px; object-fit: cover; border-radius: 10px; border: 1px solid #cbd5e1; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8; }
        </style>
        ${download ? '<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>' : ''}
      </head>
      <body>
        <!-- Top Action Bar for PDF Download & Printing -->
        <div class="no-print" style="max-width: 900px; margin: 0 auto 20px auto; background: #0286cd; padding: 14px 24px; color: white; display: flex; justify-content: space-between; align-items: center; border-radius: 16px; box-shadow: 0 10px 25px rgba(2, 134, 205, 0.25);">
          <div style="font-weight: 800; font-size: 14px; display: flex; items-center; gap: 8px;">
            <span>📄 SACC Emergency Completion Report (${job.jobNumber})</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <button onclick="window.print()" style="background: white; color: #0286cd; border: none; padding: 9px 18px; border-radius: 10px; font-weight: 900; font-size: 12px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: inline-flex; align-items: center; gap: 6px;">
              📥 SAVE AS PDF
            </button>
            <button onclick="window.print()" style="background: #0f3cad; color: white; border: none; padding: 9px 18px; border-radius: 10px; font-weight: 800; font-size: 12px; cursor: pointer;">
              🖨️ PRINT REPORT
            </button>
          </div>
        </div>

        <div class="container">
          <div class="header">
            <div>
              <div class="logo-title">SA EMERGENCY CLEANING</div>
              <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px;">Emergency Response & Service Completion Audit Report</div>
            </div>
            <div>
              <span class="badge">JOB NO: ${job.jobNumber}</span>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <h4>Customer & Site Location</h4>
              <strong style="font-size: 14px; color: #0f172a;">${escapeHtml(job.customerName)}</strong><br/>
              <span style="color: #475569;">${escapeHtml(job.address)}</span><br/>
              <div style="margin-top: 6px; font-weight: 600;">On-site Contact: ${escapeHtml(job.onsiteContact)} (${escapeHtml(job.onsitePhone)})</div>
            </div>
            <div class="card">
              <h4>Incident & Attendance Summary</h4>
              Category: <strong style="color: #0f172a;">${escapeHtml(job.category)} Emergency</strong><br/>
              Submitted At: <strong>${submittedFormatted}</strong><br/>
              Assigned Technician: <strong>${escapeHtml(job.technicianName || 'Unassigned')}</strong><br/>
              Status: <span style="color: ${isCompleted ? '#059669' : '#b45309'}; font-weight: 800;">${isCompleted ? '✓ COMPLETED & SIGNED OFF' : escapeHtml(job.status)}</span>${isCompleted ? `<br/>Completed At: <strong>${escapeHtml(completedFormatted)}</strong>` : ''}
            </div>
          </div>

          <!-- JOB TIMING & SLA RESPONSE TIMELINE LOG -->
          <div style="margin-top: 25px;" class="card">
            <h4 style="color: #0286cd; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">⏱️ Job Timing & Response SLA Audit Log</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 9px;">Lifecycle Stage</th>
                  <th style="padding: 9px;">Timestamp</th>
                  <th style="padding: 9px;">Status / Actor</th>
                </tr>
              </thead>
              <tbody>${timelineRows}
              </tbody>
            </table>

            <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">
              <div style="background: #eff6ff; padding: 10px; border-radius: 8px; border: 1px solid #bfdbfe;">
                <span style="font-size: 10px; color: #1e40af; font-weight: bold; text-transform: uppercase;">Total Response Time</span><br/>
                <strong style="font-size: 14px; color: #1d4ed8;">${responseTimeMinutes === null ? 'Not recorded' : responseTimeMinutes + ' Mins'}</strong>
              </div>
              <div style="background: #f0fdf4; padding: 10px; border-radius: 8px; border: 1px solid #bbf7d0;">
                <span style="font-size: 10px; color: #166534; font-weight: bold; text-transform: uppercase;">On-Site Labour Duration</span><br/>
                <strong style="font-size: 14px; color: #15803d;">${labourDurationMinutes} Mins</strong>
              </div>
              <div style="background: #faf5ff; padding: 10px; border-radius: 8px; border: 1px solid #e9d5ff;">
                <span style="font-size: 10px; color: #6b21a8; font-weight: bold; text-transform: uppercase;">2-4 Hr SLA Target Status</span><br/>
                <strong style="font-size: 14px; color: #7e22ce;">${slaStatus}</strong>
              </div>
            </div>
          </div>

          <div style="margin-top: 25px;" class="card">
            <h4>Work Performed & Scope Log</h4>
            <p style="color: #334155;">"${escapeHtml(job.description || 'Emergency cleaning and hazard mitigation completed in full.')}"</p>
            <p><strong>Work Labor Duration:</strong> ${labourDurationMinutes} Minutes (1-Hour Included Allowance)</p>
            <p><strong>Additional Overage Fees:</strong> $${job.additionalCharges || '0.00'}</p>
          </div>

          <div style="margin-top: 25px;">
            <h4 style="font-size: 12px; text-transform: uppercase; color: #64748b;">Photo Verification Evidence</h4>
            <div class="photos">
              ${photos.length > 0 ? photos.map(p => `<img src="${escapeHtml(p)}" alt="Incident Verification" />`).join('') : '<p style="color:#94a3b8; font-size:12px;">No photo attachments recorded.</p>'}
            </div>
          </div>

          <div class="footer">
            <p>© 2026 SA Emergency Cleaning Pty Ltd • 24/7 Emergency Response Desk • Adelaide, South Australia</p>
          </div>
        </div>
      </body>
      </html>
    `;
}
