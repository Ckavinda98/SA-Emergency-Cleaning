import React, { useState } from 'react';
import {
  Phone, MapPin, FileText, CheckCircle2, User, Wrench, Settings, Play, X, ChevronDown, Zap, Download
} from 'lucide-react';
import { TechnicianProfileModal } from './TechnicianProfileModal.jsx';
import { handleDownloadPdfReport, openPrintableReport } from '@/reports/serviceReport.js';
import { API_BASE } from '@/shared/config/env.js';

/* =========================================================================
   TECHNICIAN FIELD DISPATCH MOBILE APP COMPONENT
   ========================================================================= */
export function TechnicianApp({ jobs, setJobs, currentUser, setCurrentUser, handleLogout, showProfileModal: parentShowProfileModal, setShowProfileModal: parentSetShowProfileModal }) {
  const [techTab, setTechTab] = useState('assigned'); // 'assigned' vs 'ongoing' vs 'completed'
  const [internalShowProfileModal, setInternalShowProfileModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const showProfileModal = parentShowProfileModal !== undefined ? parentShowProfileModal : internalShowProfileModal;
  const setShowProfileModal = parentSetShowProfileModal || setInternalShowProfileModal;
  
  // 1. Assigned Requests (Dispatched by Admin, awaiting technician acceptance)
  const assignedJobs = jobs.filter(j => {
    const isAssigned = Boolean(j.technicianName && j.technicianName !== 'Unassigned');
    let isForThisTech = true;
    if (currentUser?.role === 'technician' && currentUser?.name) {
      isForThisTech = (j.technicianName || "").toLowerCase().includes(currentUser.name.toLowerCase());
    }
    const isAwaitingAccept = ['NEW', 'SUBMITTED', 'TECH_ASSIGNED'].includes(j.status);
    return isAssigned && isForThisTech && isAwaitingAccept;
  });

  // 2. Ongoing Requests (Accepted by technician, actively ongoing: ACCEPTED, TRAVELLING, ARRIVED, IN_PROGRESS)
  const ongoingJobs = jobs.filter(j => {
    const isAssigned = Boolean(j.technicianName && j.technicianName !== 'Unassigned');
    let isForThisTech = true;
    if (currentUser?.role === 'technician' && currentUser?.name) {
      isForThisTech = (j.technicianName || "").toLowerCase().includes(currentUser.name.toLowerCase());
    }
    const isOngoingState = ['ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(j.status);
    return isAssigned && isForThisTech && isOngoingState;
  });

  // 3. Completed Records
  const completedJobs = jobs.filter(j => {
    const isAssigned = Boolean(j.technicianName && j.technicianName !== 'Unassigned');
    let isForThisTech = true;
    if (currentUser?.role === 'technician' && currentUser?.name) {
      isForThisTech = (j.technicianName || "").toLowerCase().includes(currentUser.name.toLowerCase());
    }
    const isCompleted = ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status);
    return isAssigned && isForThisTech && isCompleted;
  });

  const handleStatusUpdate = async (jobId, newStatus) => {
    // The screen only changes after the server has saved the new status
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'The status could not be updated.');
        return;
      }
      setJobs(prev => prev.map(j => j.id === jobId ? data : j));
    } catch (e) {
      alert('Network error: Unable to reach the server. The status was not changed.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Technician Header Card with Settings Gear */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={currentUser?.avatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80'} alt="Dave Miller" className="w-12 h-12 rounded-2xl object-cover border border-slate-300 shadow-sm" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900">{currentUser?.name || 'Dave Miller'}</h2>
              <span className="text-[10px] bg-blue-50 text-[#0286cd] font-bold px-2 py-0.5 rounded border border-blue-200">Tech ID #104</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Senior Emergency Field Specialist • Active Dispatch Duty</p>
          </div>
        </div>

        {/* Top-Right Settings Gear Icon Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 transition-all cursor-pointer shadow-sm flex items-center gap-2 font-bold text-xs"
          >
            <Settings className="w-5 h-5 text-[#0286cd]" />
            <span>Settings</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {showSettingsMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-xs">
              <button
                onClick={() => { setShowSettingsMenu(false); setShowProfileModal(true); }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-800"
              >
                <User className="w-4 h-4 text-[#0286cd]" />
                <span>Profile</span>
              </button>
              <div className="border-t border-slate-100 my-1"></div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-2 font-semibold text-red-600"
              >
                <X className="w-4 h-4 text-red-500" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3 Tabs: Assigned Requests, Ongoing Requests, Completed Records */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-300 text-xs">
        <button
          onClick={() => setTechTab('assigned')}
          className={`flex-1 py-2.5 rounded-xl font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            techTab === 'assigned' ? 'bg-[#0286cd] text-white shadow-md' : 'text-slate-700 hover:text-slate-900 font-bold'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Assigned ({assignedJobs.length})</span>
        </button>

        <button
          onClick={() => setTechTab('ongoing')}
          className={`flex-1 py-2.5 rounded-xl font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            techTab === 'ongoing' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900 font-bold'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Ongoing ({ongoingJobs.length})</span>
        </button>

        <button
          onClick={() => setTechTab('completed')}
          className={`flex-1 py-2.5 rounded-xl font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            techTab === 'completed' ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-700 hover:text-slate-900 font-bold'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed ({completedJobs.length})</span>
        </button>
      </div>

      {/* RENDER ASSIGNED REQUESTS (AWAITING TECHNICIAN ACCEPTANCE) */}
      {techTab === 'assigned' && (
        assignedJobs.length > 0 ? (
          <div className="max-h-[580px] overflow-y-auto pr-1.5 space-y-6 custom-scroll-container">
            {assignedJobs.map(job => {
              const photos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
              const videos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');

              return (
                <div key={job.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-black text-[#0286cd] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                          {job.jobNumber || job.id}
                        </span>
                        <span className="text-xs px-3 py-1.5 rounded-lg font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm bg-blue-100 text-blue-900 border border-blue-300">
                          ⚡ DISPATCHED TO YOU (Action Required)
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-2">{job.category} Emergency</h3>
                      <p className="text-xs text-slate-600 font-medium">📍 {job.locationName || 'Service Site'} • {job.address}</p>
                    </div>

                    <a 
                      href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
                    >
                      <MapPin className="w-4 h-4" /> Open Maps Navigation
                    </a>
                  </div>

                  {/* COMPLETE REFERENCE DETAILS */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5 text-xs text-slate-800">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Complete Incident Reference & Site Info
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 font-medium">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">Customer Business Name:</span>
                        <strong className="text-slate-900">{job.customerName || 'Mahima Commercial Enterprises Pty Ltd'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">Onsite Contact Person:</span>
                        <a href={`tel:${job.onsitePhone || '0412345678'}`} className="text-[#0286cd] font-bold hover:underline flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {job.onsiteContact || 'Mahima Sharma'} ({job.onsitePhone || '0412 345 678'})
                        </a>
                      </div>
                    </div>

                    {job.description && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Description of What Happened:</span>
                        <p className="text-slate-800 leading-relaxed font-normal">"{job.description}"</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Affected Area</span>
                        <strong className="text-slate-900">{job.affectedArea || 25} m²</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Still Ongoing?</span>
                        <strong className={job.isOngoing ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                          {job.isOngoing ? 'Yes (Active Leak)' : 'No (Stopped)'}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Safe to Access?</span>
                        <strong className={job.isSafeToAccess !== false ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {job.isSafeToAccess !== false ? 'Yes (Safe)' : 'No (Hazards)'}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">SLA Target Attendance</span>
                        <strong className="text-[#0286cd]">Within 2–4 Hours</strong>
                      </div>
                    </div>

                    {/* Site Access & Security Notes */}
                    <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200 space-y-2 text-blue-950">
                      <div className="font-bold text-xs">🔑 Access & Security Instructions:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div><strong>Access:</strong> {job.accessInstructions || 'Standard keycard/reception access.'}</div>
                        <div><strong>Restrictions:</strong> {job.accessRestrictions || 'None reported.'}</div>
                        <div><strong>Parking:</strong> {job.parkingInstructions || 'Use visitor bay / loading dock.'}</div>
                      </div>
                    </div>

                    {/* Photos & Videos */}
                    {(photos.length > 0 || videos.length > 0) && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        {photos.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">Incident Photos ({photos.length})</span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {photos.map((src, i) => (
                                <a key={i} href={src} target="_blank" rel="noreferrer">
                                  <img src={src} alt="Incident Photo" className="w-20 h-20 object-cover rounded-xl border border-slate-300 hover:opacity-90 shadow-sm" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {videos.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">Incident Videos ({videos.length})</span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {videos.map((src, i) => (
                                <video key={i} src={src} controls className="w-40 h-24 rounded-xl border border-slate-300 bg-black object-cover" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Accept Dispatch Action */}
                  <button
                    onClick={() => handleStatusUpdate(job.id, 'ACCEPTED')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-4 rounded-2xl text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    ACCEPT EMERGENCY TASK DISPATCH
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl text-center text-slate-500 text-xs border border-slate-200 shadow-sm space-y-2">
            <p className="font-semibold">No new emergency dispatches awaiting technician acceptance.</p>
            <p className="text-[11px] text-slate-400">New emergency dispatches assigned by Admin will appear here immediately.</p>
          </div>
        )
      )}

      {/* RENDER ONGOING REQUESTS (ACCEPTED BY TECHNICIAN & IN-PROGRESS) */}
      {techTab === 'ongoing' && (
        ongoingJobs.length > 0 ? (
          <div className="max-h-[580px] overflow-y-auto pr-1.5 space-y-6 custom-scroll-container">
            {ongoingJobs.map(job => {
              const photos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
              const videos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');

              return (
                <div key={job.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-5">
                  {/* Job Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-black text-[#0286cd] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                          {job.jobNumber || job.id}
                        </span>
                        <span className={`text-xs px-3 py-1.5 rounded-lg font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm ${
                          job.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          job.status === 'TRAVELLING' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 animate-pulse' :
                          job.status === 'ARRIVED' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                          'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                        }`}>
                          {job.status === 'ACCEPTED' ? '✅ ACCEPTED BY YOU' :
                           job.status === 'TRAVELLING' ? '🚗 TRAVELLING TO SITE' :
                           job.status === 'ARRIVED' ? '📍 ARRIVED ON SITE' :
                           '🧹 IN PROGRESS (Cleaning)'}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-2">{job.category} Emergency</h3>
                      <p className="text-xs text-slate-600 font-medium">📍 {job.locationName || 'Service Site'} • {job.address}</p>
                    </div>

                    <a 
                      href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
                    >
                      <MapPin className="w-4 h-4" /> Open Maps Navigation
                    </a>
                  </div>

                  {/* COMPLETE REFERENCE DETAILS */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5 text-xs text-slate-800">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Complete Incident Reference & Site Info
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 font-medium">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">Customer Business Name:</span>
                        <strong className="text-slate-900">{job.customerName || 'Mahima Commercial Enterprises Pty Ltd'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">Onsite Contact Person:</span>
                        <a href={`tel:${job.onsitePhone || '0412345678'}`} className="text-[#0286cd] font-bold hover:underline flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {job.onsiteContact || 'Mahima Sharma'} ({job.onsitePhone || '0412 345 678'})
                        </a>
                      </div>
                    </div>

                    {job.description && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Description of What Happened:</span>
                        <p className="text-slate-800 leading-relaxed font-normal">"{job.description}"</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Affected Area</span>
                        <strong className="text-slate-900">{job.affectedArea || 25} m²</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Still Ongoing?</span>
                        <strong className={job.isOngoing ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                          {job.isOngoing ? 'Yes (Active Leak)' : 'No (Stopped)'}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Safe to Access?</span>
                        <strong className={job.isSafeToAccess !== false ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {job.isSafeToAccess !== false ? 'Yes (Safe)' : 'No (Hazards)'}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">SLA Target Attendance</span>
                        <strong className="text-[#0286cd]">Within 2–4 Hours</strong>
                      </div>
                    </div>

                    {/* Site Access & Security Notes */}
                    <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200 space-y-2 text-blue-950">
                      <div className="font-bold text-xs">🔑 Access & Security Instructions:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div><strong>Access:</strong> {job.accessInstructions || 'Standard keycard/reception access.'}</div>
                        <div><strong>Restrictions:</strong> {job.accessRestrictions || 'None reported.'}</div>
                        <div><strong>Parking:</strong> {job.parkingInstructions || 'Use visitor bay / loading dock.'}</div>
                      </div>
                    </div>

                    {/* Photos & Videos */}
                    {(photos.length > 0 || videos.length > 0) && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        {photos.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">Incident Photos ({photos.length})</span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {photos.map((src, i) => (
                                <a key={i} href={src} target="_blank" rel="noreferrer">
                                  <img src={src} alt="Incident Photo" className="w-20 h-20 object-cover rounded-xl border border-slate-300 hover:opacity-90 shadow-sm" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {videos.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">Incident Videos ({videos.length})</span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {videos.map((src, i) => (
                                <video key={i} src={src} controls className="w-40 h-24 rounded-xl border border-slate-300 bg-black object-cover" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* LIVE GPS SHARING BANNER (When Travelling or Onsite) */}
                  {['TRAVELLING', 'ARRIVED'].includes(job.status) && (
                    <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 rounded-2xl text-white space-y-2 shadow-lg border border-blue-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                          <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                            Live GPS Location Transmitting
                          </span>
                        </div>
                        <span className="text-[11px] font-extrabold text-blue-200 bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-700">
                          Live ETA: {job.status === 'TRAVELLING' ? '14 mins in transit' : 'On Site Now'}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-200">
                        📍 Shared location: En route on Grenfell St & King William St towards {job.locationName}
                      </p>
                    </div>
                  )}

                  {/* STEP-BY-STEP CONTROL WORKFLOW */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Technician Status Control Workflow</h4>

                    {/* Step 2: Start Driving - Travelling to Site */}
                    {job.status === 'ACCEPTED' && (
                      <button
                        onClick={() => handleStatusUpdate(job.id, 'TRAVELLING')}
                        className="w-full bg-[#0f3cad] hover:bg-[#0c2f87] text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Wrench className="w-5 h-5 text-white" />
                        🚗 START DRIVING - TRAVELLING TO SITE (Share Live GPS & ETA)
                      </button>
                    )}

                    {/* Step 3: Arrived On Site */}
                    {job.status === 'TRAVELLING' && (
                      <button
                        onClick={() => handleStatusUpdate(job.id, 'ARRIVED')}
                        className="w-full bg-purple-700 hover:bg-purple-800 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-5 h-5 text-white" />
                        📍 ARRIVED ON SITE
                      </button>
                    )}

                    {/* Step 4: Start Cleaning */}
                    {job.status === 'ARRIVED' && (
                      <button
                        onClick={() => handleStatusUpdate(job.id, 'IN_PROGRESS')}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-5 h-5 text-white" />
                        🧹 START CLEANING JOB (Start 1-Hr Included Labour Timer)
                      </button>
                    )}

                    {/* Step 5: Complete Cleaning Job & Issue Report */}
                    {job.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleStatusUpdate(job.id, 'COMPLETED')}
                        className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-black py-4 rounded-2xl text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-blue-400"
                      >
                        <CheckCircle2 className="w-5 h-5 text-white" />
                        🏁 COMPLETE CLEANING JOB & ISSUE PDF COMPLETION REPORT
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl text-center text-slate-500 text-xs border border-slate-200 shadow-sm space-y-2">
            <p className="font-semibold">No active ongoing emergency jobs accepted by technician.</p>
            <p className="text-[11px] text-slate-400">Accept an assigned request to begin live dispatch & transit tracking.</p>
          </div>
        )
      )}

      {/* RENDER COMPLETED RECORDS IN A ZERO-HORIZONTAL-SCROLL LIST */}
      {techTab === 'completed' && (
        completedJobs.length > 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden text-xs divide-y divide-slate-100">
            <div className="p-4 bg-slate-900 text-white font-extrabold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Completed Emergency Service Records ({completedJobs.length})</span>
              </div>
              <span className="text-[10px] font-mono bg-blue-900 text-blue-200 px-2.5 py-0.5 rounded border border-blue-700">
                Sign-off Log
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {completedJobs.map(job => (
                <div key={job.id} className="p-4 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#0286cd] text-xs bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                        {job.jobNumber || job.id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                        ✓ COMPLETED
                      </span>
                      <span className="text-slate-500 text-[11px] font-semibold">
                        {job.category} Emergency
                      </span>
                    </div>
                    <div className="font-extrabold text-slate-900 text-sm mt-1">{job.customerName}</div>
                    <div className="text-[11px] text-slate-500 font-normal truncate">📍 {job.locationName || 'Service Site'} • {job.address}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end">
                    <button
                      onClick={() => openPrintableReport(job.id)}
                      className="h-8 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold px-3.5 rounded-xl text-xs inline-flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => handleDownloadPdfReport(job.id, job.jobNumber)}
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 rounded-xl text-xs inline-flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl text-center text-slate-500 text-xs border border-slate-200 shadow-sm">
            No completed emergency records found for this technician.
          </div>
        )
      )}

      {/* Technician Profile Modal */}
      {showProfileModal && (
        <TechnicianProfileModal
          currentUser={currentUser}
          onUpdateUser={(updated) => {
            if (setCurrentUser) setCurrentUser(updated);
          }}
          onClose={() => setShowProfileModal(false)}
          handleLogout={handleLogout}
        />
      )}
    </div>
  );
}
