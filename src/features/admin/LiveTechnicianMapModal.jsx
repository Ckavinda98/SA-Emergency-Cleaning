import React from 'react';
import {
  Phone, MapPin, X
} from 'lucide-react';

/* =========================================================================
   MODAL: LIVE TECHNICIAN GPS LOCATION MAP (ADMIN OPERATIONS)
   ========================================================================= */
export function LiveTechnicianMapModal({ job, onClose }) {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-3xl w-full rounded-3xl overflow-hidden border border-slate-200 shadow-2xl text-xs text-slate-800 space-y-0">
        
        {/* Top Header */}
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded border border-blue-700">
                  {job.jobNumber || job.id}
                </span>
                <span className="text-emerald-400 font-extrabold text-xs tracking-wider uppercase">
                  🔴 LIVE GPS DISPATCH TELEMETRY
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white mt-1">
                {job.customerName} — {job.locationName || 'Service Site'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer p-1"><X className="w-6 h-6" /></button>
        </div>

        {/* Live Telemetry Info Bar */}
        <div className="bg-blue-950 p-4 text-white border-b border-blue-900 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-blue-900/60 p-2.5 rounded-2xl border border-blue-800">
            <div className="text-[10px] text-blue-300 font-bold uppercase">Technician</div>
            <div className="font-extrabold text-white text-xs mt-0.5 truncate">{job.technicianName || 'Dave Miller'}</div>
          </div>
          <div className="bg-blue-900/60 p-2.5 rounded-2xl border border-blue-800">
            <div className="text-[10px] text-blue-300 font-bold uppercase">Transit Speed</div>
            <div className="font-extrabold text-emerald-400 text-xs mt-0.5">38 km/h (Active)</div>
          </div>
          <div className="bg-blue-900/60 p-2.5 rounded-2xl border border-blue-800">
            <div className="text-[10px] text-blue-300 font-bold uppercase">Distance to Site</div>
            <div className="font-extrabold text-white text-xs mt-0.5">1.4 km away</div>
          </div>
          <div className="bg-blue-900/60 p-2.5 rounded-2xl border border-blue-800">
            <div className="text-[10px] text-blue-300 font-bold uppercase">Estimated Arrival (ETA)</div>
            <div className="font-extrabold text-amber-400 text-xs mt-0.5">14 Mins (On Time)</div>
          </div>
        </div>

        {/* Interactive Satellite / Vector Live Route Map Visualizer */}
        <div className="relative bg-slate-900 h-80 w-full overflow-hidden border-b border-slate-200">
          <iframe
            title="Live GPS Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(job.address || 'King William St, Adelaide CBD')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
            className="w-full h-full opacity-90 filter contrast-125"
          ></iframe>

          {/* Floating HUD Live Telemetry Overlay */}
          <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-2xl border border-slate-700 shadow-2xl max-w-xs space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="font-extrabold text-emerald-400">Transmitting GPS Coordinates</span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono">Lat: -34.9285° S, Lon: 138.6007° E</p>
            <p className="text-[11px] text-slate-300">📍 Grenfell St & King William St, Adelaide CBD</p>
          </div>

          {/* Floating Technician Vehicle Avatar Marker */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/95 backdrop-blur-md p-2 rounded-2xl border-2 border-[#0286cd] shadow-2xl flex items-center gap-2 animate-bounce">
            <img
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80"
              alt="Dave Miller"
              className="w-8 h-8 rounded-xl object-cover border border-white"
            />
            <div className="text-[11px] text-white">
              <div className="font-black text-[#0286cd]">{job.technicianName || 'Dave Miller'}</div>
              <div className="text-[9px] text-emerald-400 font-bold">🚗 En route to site</div>
            </div>
          </div>
        </div>

        {/* Footer Details & Direct Action Buttons */}
        <div className="p-5 bg-slate-50 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div>
            <div className="font-extrabold text-slate-900">Destination: {job.locationName || 'Service Location'}</div>
            <div className="text-slate-600 font-medium truncate max-w-md">{job.address}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`tel:${job.onsitePhone || '0488111222'}`}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow cursor-pointer text-xs"
            >
              <Phone className="w-4 h-4 text-white" />
              <span>Call Technician Direct</span>
            </a>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address || 'Adelaide CBD')}`}
              target="_blank"
              rel="noreferrer"
              className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow cursor-pointer text-xs"
            >
              <MapPin className="w-4 h-4 text-white" />
              <span>Open in Google Maps</span>
            </a>

            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer text-xs"
            >
              Close Live Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
