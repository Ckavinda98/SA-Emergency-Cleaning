import React, { useState } from 'react';
import {
  ShieldAlert, CheckCircle2, X
} from 'lucide-react';

/* =========================================================================
   MODAL: DISPATCH & ASSIGN TECHNICIAN
   ========================================================================= */
export function AssignDispatchModal({ job, technicians, onClose, onAssign }) {
  const [selectedTech, setSelectedTech] = useState(job?.technicianName || technicians[0]?.name || 'Dave Miller');
  const [status, setStatus] = useState(job?.status && job?.status !== 'NEW' && job?.status !== 'SUBMITTED' ? job.status : 'TECH_ASSIGNED');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAssign(selectedTech, status);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[90vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#0286cd]" />
            Dispatch Job {job.jobNumber || job.id}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* Job Summary Banner */}
        <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 space-y-1 text-blue-950">
          <div className="font-extrabold text-sm text-[#0286cd]">{job.customerName} • {job.category} Emergency</div>
          <div className="text-xs font-semibold text-slate-700">📍 Location: {job.locationName} ({job.address})</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-900 font-extrabold text-xs mb-2 uppercase tracking-wider">
              Select Field Technician (Real-Time Roster Status):
            </label>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 custom-scroll-container">
              {technicians.map(t => {
                const isSelected = selectedTech === t.name;
                const isOnSite = t.status === 'ON_SITE';
                const isAvailable = t.status === 'AVAILABLE';

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTech(t.name)}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'border-[#0286cd] bg-blue-50/80 shadow-md ring-2 ring-[#0286cd]/20' 
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={t.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                        alt={t.name}
                        className="w-11 h-11 rounded-2xl object-cover border border-slate-300 shadow-sm shrink-0"
                      />
                      <div>
                        <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                          {t.name}
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#0286cd]" />}
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">📞 {t.phone} • ⭐ {t.rating || 5.0}</div>
                      </div>
                    </div>

                    {/* Real-Time Status Badge */}
                    <div>
                      {isOnSite ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                          📍 ON SITE
                        </span>
                      ) : isAvailable ? (
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          🟢 AVAILABLE
                        </span>
                      ) : (
                        <span className="bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wider">
                          ⚪ OFF DUTY
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Set Initial Dispatch Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold">
              <option value="TECH_ASSIGNED">TECH_ASSIGNED (Dispatched to Tech)</option>
              <option value="ACCEPTED">ACCEPTED (Accepted & En Route)</option>
              <option value="IN_PROGRESS">IN_PROGRESS (On-site Emergency Service)</option>
              <option value="MORE_INFO_REQUIRED">MORE_INFO_REQUIRED (Pause SLA Clock)</option>
            </select>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl cursor-pointer text-xs">
              Cancel
            </button>
            <button type="submit" className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-lg transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-white" /> CONFIRM DISPATCH & ASSIGNMENT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
