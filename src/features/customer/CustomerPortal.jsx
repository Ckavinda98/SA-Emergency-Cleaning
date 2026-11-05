import React, { useState } from 'react';
import {
  ShieldAlert, Phone, Clock, MapPin, AlertTriangle, FileText, Award, PlusCircle, User, Building, Settings, AlertCircle, Play, X, Shield, Camera, Edit3, Plus, ChevronDown, Zap, Download
} from 'lucide-react';
import { LiveTechnicianMapModal } from '@/features/admin';
import { handleDownloadPdfReport, openPrintableReport } from '@/reports/serviceReport.js';

/* =========================================================================
   CUSTOMER PORTAL COMPONENT
   ========================================================================= */
/* =========================================================================
   CUSTOMER PORTAL COMPONENT
   ========================================================================= */
export function CustomerPortal({ 
  account, 
  activePlan, 
  config, 
  jobs, 
  setJobs, 
  setShowNewRequestModal, 
  setShowRedemptionModal, 
  setShowCalloutExplanationModal, 
  setShowProfileModal, 
  setShowCancelSubscriptionModal,
  setShowChangePlanModal,
  setEditingJob,
  handleLogout
}) {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const calloutsRemaining = Math.max(0, (activePlan?.callouts || 2) - account.calloutsUsed);
  const isTenureUnlocked = account.consecutiveMonths >= config.tenureMinMonths;
  const isCancelled = account.subscriptionStatus === 'CANCELLED';

  // Filter all emergency jobs for this business customer account
  const [requestListTab, setRequestListTab] = useState('ongoing'); // 'ongoing' or 'past'
  const [selectedJobForLiveMap, setSelectedJobForLiveMap] = useState(null);

  const customerJobs = jobs.filter(j => j.organizationId === account.id || j.customerName === account.businessName);

  const ongoingJobs = customerJobs.filter(j => 
    !['COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'CANCELLED'].includes(j.status)
  );

  const pastJobs = customerJobs.filter(j => 
    ['COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'CANCELLED'].includes(j.status)
  );

  const displayedJobs = requestListTab === 'ongoing' ? ongoingJobs : pastJobs;
  const isCalloutsExhausted = calloutsRemaining <= 0 || account.calloutsUsed >= (activePlan?.callouts || 2);

  return (
    <div className="space-y-8">
      {/* Customer Header Info Bar with Settings Gear Dropdown */}
      <div className="bg-white p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-slate-200 shadow-md relative">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{account.businessName}</h2>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              isCancelled 
                ? 'bg-red-50 text-red-700 border-red-200' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isCancelled ? '❌ Subscription Cancelled' : '✓ Active Membership'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            ABN: {account.abn} • Contact: {account.primaryContactName || account.primaryContact} ({account.phoneNumber || account.phone}) • {account.email}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-semibold">
            💳 Payment: {account.paymentMethod}
          </span>

          {/* Settings Gear Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold p-2.5 rounded-xl text-xs flex items-center gap-2 border border-slate-300 transition-all cursor-pointer shadow-sm"
              title="Account Settings"
            >
              <Settings className="w-4 h-4 text-[#0286cd]" />
              <span>Settings</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {/* Dropdown Menu */}
            {showSettingsMenu && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 py-2 text-xs divide-y divide-slate-100"
                onClick={() => setShowSettingsMenu(false)}
              >
                <div className="py-1">
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-800"
                  >
                    <User className="w-4 h-4 text-[#0286cd]" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => setShowChangePlanModal(true)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-800"
                  >
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span>Change Plan</span>
                  </button>
                </div>
                {!isCancelled && (
                  <div className="py-1">
                    <button
                      onClick={() => setShowCancelSubscriptionModal(true)}
                      className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-2 font-semibold text-red-600"
                    >
                      <X className="w-4 h-4 text-red-500" />
                      <span>Cancel Subscription</span>
                    </button>
                  </div>
                )}
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-600"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CENTERED PRIMARY EMERGENCY ASSISTANCE BANNER TILE (TOP OF SYSTEM) */}
      {isCalloutsExhausted ? (
        <div className="bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800 p-8 rounded-3xl text-white text-center shadow-xl border border-amber-400/30 max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
            <AlertTriangle className="w-8 h-8 text-amber-200 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tight">Call-out Limit Exhausted (0 Remaining)</h2>
            <p className="text-sm font-semibold text-amber-100">
              You have used all {account.calloutsUsed} of {activePlan?.callouts} call-outs for your {activePlan?.name} plan this month.
            </p>
          </div>
          <div>
            <button
              onClick={() => setShowChangePlanModal(true)}
              className="bg-white hover:bg-slate-100 text-amber-900 font-black py-4 px-8 rounded-2xl text-xs sm:text-sm inline-flex items-center justify-center gap-3 transition-all shadow-xl hover:scale-105 cursor-pointer border border-white"
            >
              <Shield className="w-5 h-5 text-amber-700" />
              0 CALL-OUTS REMAINING - UPGRADE PLAN TO REQUEST
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-[#0f3cad] via-[#0286cd] to-[#026fa8] p-8 rounded-3xl text-white text-center shadow-xl border border-white/20 max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
            <ShieldAlert className="w-8 h-8 text-amber-300 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tight">Need Emergency Assistance?</h2>
            <p className="text-sm font-semibold text-blue-100">2–4 Hour Target Attendance On-Site • 24/7 Response Desk</p>
          </div>
          <div>
            <button
              onClick={() => setShowNewRequestModal(true)}
              className="bg-white hover:bg-slate-100 text-[#0f3cad] font-black py-4 px-8 rounded-2xl text-xs sm:text-sm inline-flex items-center justify-center gap-3 transition-all shadow-xl hover:scale-105 cursor-pointer border border-white"
            >
              <PlusCircle className="w-5 h-5 text-[#0f3cad]" />
              REQUEST EMERGENCY CLEANING
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD METRIC TILES GRID (BELOW MAIN REQUEST TILE) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Membership Plan Card */}
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-[#0286cd] border border-slate-200 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Active Membership</span>
            <Shield className="w-4 h-4 text-[#0286cd]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">{activePlan?.name} Plan</span>
            <span className="text-sm font-bold text-[#0286cd]">${activePlan?.price}/mo</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-600">{activePlan?.callouts} Included Call-out(s) / mo</p>
            <button
              onClick={() => setShowChangePlanModal(true)}
              className="text-[11px] text-[#0286cd] font-bold underline hover:text-[#026fa8] cursor-pointer"
            >
              Change Plan
            </button>
          </div>
        </div>

        {/* Included Call-Outs Balance Card */}
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-emerald-500 border border-slate-200 shadow-md space-y-2 relative">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Call-outs Remaining</span>
            <button 
              onClick={() => setShowCalloutExplanationModal(true)}
              className="text-[10px] text-[#0286cd] bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 font-bold cursor-pointer"
            >
              <AlertCircle className="w-3 h-3 text-[#0286cd]" /> Explain This
            </button>
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-extrabold ${isCalloutsExhausted ? 'text-amber-600' : 'text-emerald-600'}`}>
              {calloutsRemaining} / {activePlan?.callouts}
            </span>
            <span className="text-xs text-slate-500">Resets in 12 days</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
            <div 
              className={`h-full rounded-full transition-all ${isCalloutsExhausted ? 'bg-amber-500' : 'bg-emerald-500'}`} 
              style={{ width: `${(calloutsRemaining / (activePlan?.callouts || 1)) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Reward Points Wallet */}
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-purple-500 border border-slate-200 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Reward Points Wallet</span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-purple-700">{account.pointsBalance} pts</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
              isTenureUnlocked 
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {isTenureUnlocked ? 'Redemptions Active' : 'Tenure Lock'}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Active member for {account.consecutiveMonths} months ({isTenureUnlocked ? 'Unlocked!' : `Requires ${config.tenureMinMonths} months`})
          </p>
        </div>
      </div>

      {/* REQUESTS LIST WITH ONGOING / PAST TOGGLE BUTTONS */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#0286cd]" />
              Emergency Call-outs & Service Logs
            </h3>
            <p className="text-xs text-slate-600">Track ongoing SLA dispatches and view past service completion history</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Two Filter Toggle Buttons for Ongoing & Past */}
            <div className="bg-slate-100 p-1 rounded-2xl border border-slate-300 flex items-center gap-1">
              <button
                onClick={() => setRequestListTab('ongoing')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  requestListTab === 'ongoing'
                    ? 'bg-[#0286cd] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 font-semibold'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Ongoing Requests ({ongoingJobs.length})</span>
              </button>
              <button
                onClick={() => setRequestListTab('past')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  requestListTab === 'past'
                    ? 'bg-[#0286cd] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 font-semibold'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Past Records ({pastJobs.length})</span>
              </button>
            </div>

            <button
              onClick={() => isCalloutsExhausted ? setShowChangePlanModal(true) : setShowNewRequestModal(true)}
              className={`font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                isCalloutsExhausted ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-[#0286cd] hover:bg-[#026fa8] text-white'
              }`}
            >
              {isCalloutsExhausted ? <AlertTriangle className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4" />}
              {isCalloutsExhausted ? '0 CALL-OUTS REMAINING' : 'NEW REQUEST'}
            </button>
          </div>
        </div>

        {displayedJobs.length > 0 ? (
          <div className="custom-scroll-container space-y-6">
            {displayedJobs.map((job, idx) => {
              const photos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
              const videos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');
              const formattedStatus = (job.status || 'SUBMITTED').replace(/_/g, ' ');
              const isAcceptedOrCompleted = ['ACCEPTED', 'TECHNICIAN_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status);
              
              // Determine active step index (1..5)
              const isAccepted = ['ACCEPTED', 'TECH_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) || Boolean(job.technicianName && job.technicianName !== 'Unassigned');
              
              let activeStepIndex = 1;
              if (isAccepted) activeStepIndex = 2;
              if (['TECH_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) && Boolean(job.technicianName && job.technicianName !== 'Unassigned')) activeStepIndex = 3;
              if (['IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status)) activeStepIndex = 4;
              if (['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status)) activeStepIndex = 5;

              return (
                <div key={job.id} className="bg-white p-6 rounded-3xl space-y-6 border border-slate-200 shadow-md hover:shadow-lg transition-all relative">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-extrabold text-[#0286cd] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                          {job.jobNumber || job.id}
                        </span>
                        <span className={`text-xs px-3 py-1.5 rounded-lg font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm ${
                          ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-700 text-white border border-emerald-800' :
                          job.status === 'IN_PROGRESS' ? 'bg-amber-500 text-white border border-amber-600 animate-pulse shadow-md' :
                          job.status === 'ARRIVED' ? 'bg-purple-600 text-white border border-purple-700 animate-pulse shadow-md' :
                          job.status === 'TRAVELLING' ? 'bg-indigo-600 text-white border border-indigo-700 animate-pulse shadow-md' :
                          job.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          job.status === 'TECH_ASSIGNED' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                          'bg-slate-100 text-slate-800 border border-slate-300'
                        }`}>
                          {['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? '🎉 COMPLETED' :
                           job.status === 'IN_PROGRESS' ? '🧹 CLEANING IN PROGRESS' :
                           job.status === 'ARRIVED' ? '📍 TECHNICIAN ARRIVED ON SITE' :
                           job.status === 'TRAVELLING' ? '🚗 TECHNICIAN EN ROUTE (Travelling)' :
                           job.status === 'ACCEPTED' ? '✅ ACCEPTED BY TECHNICIAN' :
                           job.status === 'TECH_ASSIGNED' ? '👤 ADMIN DISPATCHED TO TECHNICIAN' :
                           '⏳ SUBMITTED (Awaiting Acceptance)'}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          ✓ Monthly Included Call-out #{idx + 1}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-2">{job.category} Emergency</h3>
                      <p className="text-xs text-slate-600 font-medium">📍 {job.locationName || 'Site Location'} • {job.address}</p>
                      {job.description && (
                        <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 font-normal">
                          "{job.description}"
                        </p>
                      )}
                    </div>

                    <div className="text-right space-y-2">
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <div className="text-xs text-slate-500 font-semibold">Target Attendance Time</div>
                        <div className="text-xs sm:text-sm font-extrabold text-[#0286cd] flex items-center gap-1.5 justify-end mt-0.5">
                          <Clock className="w-4 h-4 text-[#0286cd]" />
                          Within 2–4 Hours (On Schedule)
                        </div>
                      </div>

                      {/* PDF Completion Report & Download Option Buttons */}
                      {['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? (
                        <div className="flex flex-col gap-1.5 w-full">
                          <button
                            onClick={() => openPrintableReport(job.id)}
                            className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-white" />
                            <span>View PDF Report</span>
                          </button>
                          <button
                            onClick={() => handleDownloadPdfReport(job.id, job.jobNumber)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-white" />
                            <span>📥 Download</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {(job.status === 'NEW' || job.status === 'SUBMITTED') && (
                            <button
                              onClick={() => setEditingJob(job)}
                              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer border border-slate-700"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Edit Request Details</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DEDICATED TECHNICIAN ARRIVED ON SITE ALERT CARD */}
                  {job.status === 'ARRIVED' && (
                    <div className="bg-purple-900 p-4.5 rounded-3xl text-white space-y-2 shadow-xl border-2 border-purple-400 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-700 rounded-2xl">
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-purple-200 uppercase tracking-wider">Arrival Notification</div>
                          <h4 className="text-base font-black text-white">
                            📍 Technician {job.technicianName || 'Dave Miller'} Has Arrived On Site!
                          </h4>
                        </div>
                      </div>
                      <p className="text-xs text-purple-100 font-medium pl-11">
                        Technician is present at <strong>{job.locationName || 'your site location'}</strong> (Parked at loading dock/visitor bay). Preparing emergency cleaning equipment to commence work.
                      </p>
                    </div>
                  )}

                  {/* LIVE TECHNICIAN GPS LOCATION & LIVE ETA BANNER WITH INTERACTIVE MAP */}
                  {['TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(job.status) && (
                    <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-4.5 rounded-3xl text-white space-y-3.5 shadow-xl border border-blue-700/50">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-800/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                          </span>
                          <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                            {job.status === 'TRAVELLING' ? '🟢 LIVE GPS DISPATCH TRACKING' : job.status === 'ARRIVED' ? '📍 TECHNICIAN ARRIVED ON-SITE' : '🧹 CLEANING IN PROGRESS'}
                          </span>
                        </div>
                        <span className="text-[11px] font-extrabold text-purple-200 bg-purple-950/90 px-3 py-1 rounded-lg border border-purple-700/60">
                          Live Status: {job.status === 'TRAVELLING' ? '14 Mins (In Transit)' : job.status === 'ARRIVED' ? '📍 On Site Now' : 'Active Service'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Assigned Dispatch Technician</div>
                          <div className="font-extrabold text-white text-sm flex items-center gap-1.5 mt-0.5">
                            <User className="w-4 h-4 text-[#0286cd]" />
                            {job.technicianName || 'Dave Miller (Tech ID #104)'}
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1">
                            📍 Live Location: {job.status === 'TRAVELLING' ? 'En route on Grenfell St & King William St, Adelaide CBD (1.4 km away)' : 'Parked at Loading Dock Bay 3'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setSelectedJobForLiveMap(job)}
                            className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer animate-pulse"
                          >
                            <MapPin className="w-4 h-4" />
                            <span>🗺️ View Live GPS Map</span>
                          </button>

                          <a
                            href={`tel:${job.onsitePhone || '0488111222'}`}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
                          >
                            <Phone className="w-3.5 h-3.5" /> Call Tech Direct
                          </a>
                        </div>
                      </div>

                      {/* Embedded Interactive Map Preview for Customer */}
                      <div className="relative h-44 rounded-2xl overflow-hidden border border-blue-700/60 shadow-inner">
                        <iframe
                          title="Customer Live Map Preview"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          scrolling="no"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(job.address || 'King William St, Adelaide CBD')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                          className="w-full h-full opacity-90 filter contrast-125 pointer-events-none"
                        ></iframe>
                        <div
                          onClick={() => setSelectedJobForLiveMap(job)}
                          className="absolute inset-0 bg-slate-900/30 hover:bg-slate-900/10 cursor-pointer transition-all flex items-center justify-center"
                        >
                          <span className="bg-slate-900/90 text-white font-black px-4 py-2 rounded-xl text-xs shadow-2xl border border-slate-700 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#0286cd]" />
                            <span>Click to Expand Fullscreen Live Map</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Technician & Onsite Info */}
                  {job.technicianName && (
                    <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Dispatch Technician: <strong className="text-slate-900">{job.technicianName}</strong></span>
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                        ✓ Attendance SLA On Track
                      </span>
                    </div>
                  )}

                  {/* Live Response Timeline (7 Full Stages) */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Response 7-Stage SLA Timeline</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-center text-[10px] sm:text-[11px]">
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        ['SUBMITTED', 'NEW', 'TECH_ASSIGNED', 'ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status)
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        1. Submitted
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        ['TECH_ASSIGNED', 'ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) && Boolean(job.technicianName && job.technicianName !== 'Unassigned')
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        2. Admin Dispatched
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        ['ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status)
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        3. Tech Accepted
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        job.status === 'TRAVELLING' ? 'bg-indigo-600 border-indigo-700 text-white font-extrabold animate-pulse shadow-md' :
                        ['ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        4. Travelling
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        job.status === 'ARRIVED' ? 'bg-purple-600 border-purple-700 text-white font-extrabold animate-pulse shadow-md' :
                        ['IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        5. Arrived
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        job.status === 'IN_PROGRESS' ? 'bg-amber-500 border-amber-600 text-white font-extrabold animate-pulse shadow-md' :
                        ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        6. Cleaning Active
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-600 border-emerald-700 text-white font-extrabold shadow-md' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        7. Completed
                      </div>
                    </div>
                  </div>

                  {/* Photos & Videos Media Gallery */}
                  {(photos.length > 0 || videos.length > 0) && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      {photos.length > 0 && (
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-[#0286cd]" /> Uploaded Incident Photos ({photos.length})
                          </h4>
                          <div className="flex gap-3 overflow-x-auto pb-1">
                            {photos.map((src, i) => (
                              <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 group">
                                <img src={src} alt={`Incident Photo ${i+1}`} className="w-24 h-24 object-cover rounded-2xl border border-slate-200 shadow-sm group-hover:scale-105 transition-all" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {videos.length > 0 && (
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5 text-purple-600 fill-purple-600" /> Uploaded Short Video Clips ({videos.length})
                          </h4>
                          <div className="flex gap-3 overflow-x-auto pb-1">
                            {videos.map((src, i) => (
                              <div key={i} className="bg-slate-900 p-2 rounded-2xl text-white text-xs space-y-1.5 w-52 flex-shrink-0 border border-slate-800 shadow-md">
                                <div className="flex items-center justify-between font-bold text-purple-300 text-[11px]">
                                  <span className="flex items-center gap-1"><Play className="w-3 h-3 fill-purple-300" /> Video #{i + 1}</span>
                                  <span className="text-[9px] text-slate-400 font-mono">MP4/WebM</span>
                                </div>
                                {src.startsWith('data:video') || src.endsWith('.mp4') || src.endsWith('.webm') || src.includes('mixkit') || src.includes('video') ? (
                                  <video src={src} controls className="w-full h-28 rounded-xl object-cover bg-black" />
                                ) : (
                                  <a href={src} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 underline font-mono truncate block p-2 bg-slate-800 rounded-lg">
                                    🔗 Open Video Media Link
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl text-center text-slate-500 text-xs border border-slate-200 shadow-sm space-y-3">
            <p>{requestListTab === 'ongoing' ? 'No ongoing emergency requests currently in progress.' : 'No past callout records found for this business account.'}</p>
            {requestListTab === 'ongoing' && (
              <button
                onClick={() => setShowNewRequestModal(true)}
                className="bg-[#0286cd] text-[#ffffff] font-extrabold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" /> Create Emergency Request
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reward Points Redemption Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4" />
            Emergency Reward Points Catalog
          </div>
          <h3 className="text-lg font-bold text-slate-900">Redeem Accumulated Points for Free Periodical Cleaning</h3>
          <p className="text-xs text-slate-600">Steam cleaning, pressure washing, tile & grout, deep cleaning & high dusting.</p>
        </div>
        <button
          onClick={() => setShowRedemptionModal(true)}
          className="bg-purple-700 hover:bg-purple-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs whitespace-nowrap shadow transition-all cursor-pointer"
        >
          REDEEM MY POINTS
        </button>
      </div>

      {/* Service Locations Section */}
      <div className="bg-white p-6 rounded-3xl space-y-4 border border-slate-200 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-4 h-4 text-[#0286cd]" />
            Registered Service Locations
          </h3>
          <span className="text-xs text-slate-500 font-semibold">{(account.locations || []).length} Sites</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(account.locations || []).map(loc => (
            <div key={loc.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-xs text-slate-900">{loc.name}</div>
              <p className="text-[11px] text-slate-600">{loc.address}</p>
              <div className="text-[10px] text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 font-mono">
                🔑 Access: {loc.accessInstructions}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: LIVE TECHNICIAN GPS LOCATION MAP FOR CUSTOMER */}
      {selectedJobForLiveMap && (
        <LiveTechnicianMapModal
          job={selectedJobForLiveMap}
          onClose={() => setSelectedJobForLiveMap(null)}
        />
      )}
    </div>
  );
}
