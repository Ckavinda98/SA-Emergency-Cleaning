import React from 'react';
import {
  FileText, X, Download
} from 'lucide-react';
import { handleDownloadPdfReport, openPrintableReport } from '@/reports/serviceReport.js';

/* =========================================================================
   MODAL: ADMIN JOB DETAILS (FOR NEW, ACCEPTED & COMPLETED REQUESTS)
   ========================================================================= */
export function AdminJobDetailsModal({ job, onClose, onDispatchClick }) {
  if (!job) return null;
  const photos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
  const videos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[92vh] overflow-y-auto custom-scroll-container">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-[#0286cd] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {job.jobNumber || job.id}
              </span>
              <span className={`font-black px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider ${
                job.status === 'NEW' || job.status === 'SUBMITTED' ? 'bg-blue-600 text-white shadow-sm' :
                job.status === 'COMPLETED' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                job.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                {job.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 mt-1">{job.customerName} — {job.category} Emergency</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Customer & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Customer Contact Info</div>
            <div className="font-extrabold text-slate-900">{job.onsiteContact || job.customerName}</div>
            <div className="text-slate-600 font-medium">📞 Phone: <a href={`tel:${job.onsitePhone}`} className="text-[#0286cd] font-bold hover:underline">{job.onsitePhone || 'Not specified'}</a></div>
            <div className="text-slate-500 text-[11px]">Submitted: {job.submittedAt ? new Date(job.submittedAt).toLocaleString() : 'Recent'}</div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Site Location & Address</div>
            <div className="font-extrabold text-slate-900">{job.locationName || 'Service Site'}</div>
            <div className="text-slate-600 font-medium truncate">{job.address}</div>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer" className="text-[#0286cd] font-bold text-[11px] hover:underline flex items-center gap-1 mt-0.5">
              <span>📍 Open in Google Maps</span>
            </a>
          </div>
        </div>

        {/* Incident Details Grid */}
        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 space-y-3">
          <div className="font-bold text-[#0286cd] uppercase text-xs tracking-wider">Incident Technical Specifications</div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-slate-800 font-bold">
            <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-normal uppercase">Affected Area</div>
              <div className="text-xs font-extrabold text-slate-900">{job.affectedArea ? `${job.affectedArea} m²` : 'N/A'}</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-normal uppercase">Incident Time</div>
              <div className="text-xs font-extrabold text-slate-900">{job.incidentTime ? new Date(job.incidentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-normal uppercase">Still Ongoing?</div>
              <div className="text-xs font-extrabold text-slate-900">{job.isOngoing ? '🔴 YES' : '🟢 NO'}</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-normal uppercase">Safe to Access?</div>
              <div className="text-xs font-extrabold text-slate-900">{job.isSafeToAccess !== false ? '✅ SAFE' : '⚠️ HAZARD'}</div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-700">Detailed Description of Incident:</div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-800 font-medium italic mt-1 text-xs">
              "{job.description || 'No additional description provided.'}"
            </div>
          </div>
        </div>

        {/* Site Access & Security Instructions */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
          <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">Access, Security & Parking Instructions</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="font-bold text-slate-700 block">Access Instructions:</span>
              <span className="text-slate-600 font-medium">{job.accessInstructions || 'Standard keycard/reception access.'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700 block">Access Restrictions:</span>
              <span className="text-slate-600 font-medium">{job.accessRestrictions || 'None reported.'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700 block">Parking / Security:</span>
              <span className="text-slate-600 font-medium">{job.parkingInstructions || 'Use visitor bay / loading dock.'}</span>
            </div>
          </div>
        </div>

        {/* Media Attachments */}
        {(photos.length > 0 || videos.length > 0) && (
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">Incident Media Attachments</div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noreferrer">
                    <img src={src} alt="Incident Photo" className="w-full h-24 object-cover rounded-xl border border-slate-300 hover:opacity-90 shadow-sm transition-all" />
                  </a>
                ))}
              </div>
            )}

            {videos.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-700">Incident Videos ({videos.length}):</div>
                <div className="grid grid-cols-2 gap-2">
                  {videos.map((vid, idx) => (
                    <video key={idx} controls src={vid} className="w-full rounded-xl border border-slate-300 bg-black h-28 object-cover shadow-sm" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF Completion Report & Download Options - Available for Completed Jobs */}
        {['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) && (
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-extrabold text-emerald-900 text-xs">Official Emergency Service Completion Report</div>
              <div className="text-[11px] text-emerald-700 font-medium">Technician verified work, digital sign-off & SLA audit log ready.</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openPrintableReport(job.id)}
                className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-white" /> View PDF
              </button>
              <button
                onClick={() => handleDownloadPdfReport(job.id, job.jobNumber)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer inline-flex items-center"
              >
                <Download className="w-4 h-4 text-white" /> 📥 Download
              </button>
            </div>
          </div>
        )}

        {/* Assigned Technician & Actions */}
        <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-300 flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-bold text-[11px] uppercase">Assigned Technician:</span>
            <div className="font-extrabold text-slate-900 text-sm mt-0.5">{job.technicianName || 'Unassigned'}</div>
          </div>
          <button
            onClick={() => {
              onClose();
              if (onDispatchClick) onDispatchClick(job);
            }}
            className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow transition-all cursor-pointer"
          >
            ⚡ Dispatch / Reassign Technician
          </button>
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer">
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
