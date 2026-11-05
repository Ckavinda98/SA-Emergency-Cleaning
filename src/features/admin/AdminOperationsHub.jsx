import React, { useState } from 'react';
import {
  ShieldAlert, Phone, MapPin, FileText, Award, CheckCircle2, User, Building, Wrench, Users, BarChart3, Edit3, Plus, Zap
} from 'lucide-react';
import { AddTechnicianModal } from './AddTechnicianModal.jsx';
import { AdminJobDetailsModal } from './AdminJobDetailsModal.jsx';
import { AssignDispatchModal } from './AssignDispatchModal.jsx';
import { EditTechnicianModal } from './EditTechnicianModal.jsx';
import { LiveTechnicianMapModal } from './LiveTechnicianMapModal.jsx';
import { API_BASE } from '@/shared/config/env.js';

/* =========================================================================
   COMPREHENSIVE ADMIN OPERATIONS & ACCOUNTS HUB COMPONENT
   ========================================================================= */
export function AdminOperationsHub({ jobs, setJobs, config, customers, setCustomers, setSelectedCustomerId, setActiveTab, technicians, setTechnicians, setShowHotlineModal, openCompanyRegistrationModal, adminSubTab: parentSubTab, setAdminSubTab: parentSetSubTab }) {
  const [internalSubTab, setInternalSubTab] = useState('dispatch');
  const adminSubTab = parentSubTab || internalSubTab;
  const setAdminSubTab = parentSetSubTab || setInternalSubTab;
  const [showAddTechModal, setShowAddTechModal] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [selectedJobForDispatch, setSelectedJobForDispatch] = useState(null);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState(null);
  const [selectedJobForLiveMap, setSelectedJobForLiveMap] = useState(null);
  const [dispatchFilter, setDispatchFilter] = useState('ALL'); // 'ALL', 'NEW', 'ACCEPTED', 'COMPLETED'

  const handleInspectCustomer = (custId) => {
    setSelectedCustomerId(custId);
    setActiveTab('customer');
  };

  const handleAssignTechnician = async (jobId, techName, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianName: techName, status: newStatus || 'TECH_ASSIGNED' })
      });
      const updated = await res.json();
      if (!res.ok) {
        alert(updated.error || 'The technician could not be assigned.');
        return;
      }
      setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
      // The server also updated the technician's status, so reload the roster
      const techRes = await fetch(`${API_BASE}/technicians`);
      if (techRes.ok) setTechnicians(await techRes.json());
    } catch (e) {
      alert('Network error: Unable to reach the server. The technician was not assigned.');
      return;
    }
    setSelectedJobForDispatch(null);
  };

  return (
    <div className="space-y-6">
      {/* Admin Operations Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#0286cd]" />
            Admin Operations & Business Management Desk
          </h2>
          <p className="text-xs text-slate-600">Manage Customers, Multi-site Accounts, Call-out Allowances, Technician Dispatch & Reward Points</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openCompanyRegistrationModal()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Building className="w-4 h-4 text-white" />
            REGISTER COMPANY (SYSTEM ADMIN)
          </button>

          <button
            onClick={() => setShowHotlineModal(true)}
            className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Phone className="w-4 h-4" />
            CREATE HOTLINE PHONE REQUEST
          </button>
        </div>
      </div>

      {/* Admin Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200 text-xs font-medium">
        <button
          onClick={() => setAdminSubTab('dispatch')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'dispatch' ? 'bg-[#0286cd] text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Incident Dispatch & SLA ({jobs.length})
        </button>

        <button
          onClick={() => setAdminSubTab('customers')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'customers' ? 'bg-[#0286cd] text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Accounts Directory ({customers.length})
        </button>

        <button
          onClick={() => setAdminSubTab('technicians')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'technicians' ? 'bg-[#0286cd] text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Technician Fleet ({technicians.length})
        </button>

        <button
          onClick={() => setAdminSubTab('points')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'points' ? 'bg-[#0f3cad] text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4" />
          Reward Points Approvals
        </button>

        <button
          onClick={() => setAdminSubTab('reports')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'reports' ? 'bg-emerald-600 text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Reports & Analytics
        </button>
      </div>

      {/* SUB-TAB 1: INCIDENT DISPATCH QUEUE & SLA MONITOR */}
      {adminSubTab === 'dispatch' && (() => {
        const newJobsCount = jobs.filter(j => j.status === 'NEW' || j.status === 'SUBMITTED').length;
        const acceptedJobsCount = jobs.filter(j => ['ACCEPTED', 'TECH_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(j.status) || (j.technicianName && j.technicianName !== 'Unassigned' && !['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status))).length;
        const completedJobsCount = jobs.filter(j => ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status)).length;

        const filteredJobs = jobs.filter(j => {
          if (dispatchFilter === 'NEW') return j.status === 'NEW' || j.status === 'SUBMITTED';
          if (dispatchFilter === 'ACCEPTED') return ['ACCEPTED', 'TECH_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(j.status) || (j.technicianName && j.technicianName !== 'Unassigned' && !['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status));
          if (dispatchFilter === 'COMPLETED') return ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status);
          return true;
        });

        return (
          <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#0286cd]" />
                  Live Emergency Dispatch Desk
                </h3>
                <p className="text-xs text-slate-600">Filter by status state and inspect complete emergency request details</p>
              </div>

              {/* 3 Status Buttons: New Requests, Accepted Requests, Completed Requests */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setDispatchFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    dispatchFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 font-bold'
                  }`}
                >
                  📋 All ({jobs.length})
                </button>

                <button
                  onClick={() => setDispatchFilter('NEW')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                    dispatchFilter === 'NEW'
                      ? 'bg-[#0286cd] text-white shadow-sm'
                      : 'text-slate-700 hover:text-[#0286cd] font-bold'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  <span>New Requests ({newJobsCount})</span>
                </button>

                <button
                  onClick={() => setDispatchFilter('ACCEPTED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                    dispatchFilter === 'ACCEPTED'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-emerald-700 font-bold'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Accepted Requests ({acceptedJobsCount})</span>
                </button>

                <button
                  onClick={() => setDispatchFilter('COMPLETED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                    dispatchFilter === 'COMPLETED'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-purple-700 font-bold'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-purple-300" />
                  <span>Completed Requests ({completedJobsCount})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3 px-4">Job Number</th>
                    <th className="py-3 px-4">Customer Business</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Incident Category</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Tech</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredJobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50 transition-all">
                      <td className="py-3.5 px-4 align-middle font-mono font-bold text-[#0286cd] whitespace-nowrap">{job.jobNumber || job.id}</td>
                      <td className="py-3.5 px-4 align-middle font-semibold text-slate-900">{job.customerName}</td>
                      <td className="py-3.5 px-4 align-middle text-slate-600">{job.locationName}</td>
                      <td className="py-3.5 px-4 align-middle text-slate-600 whitespace-nowrap">{job.category}</td>
                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        {(() => {
                          const s = (job.status || 'NEW').toUpperCase();
                          if (s === 'NEW' || s === 'SUBMITTED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-[#0286cd] text-white border-blue-600 shadow-md animate-pulse">
                                ✨ NEW
                              </span>
                            );
                          }
                          if (s === 'TECH_ASSIGNED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-blue-100 text-blue-900 border-blue-300 shadow-sm">
                                👤 TECH ASSIGNED
                              </span>
                            );
                          }
                          if (s === 'ACCEPTED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm">
                                ✅ TECHNICIAN ACCEPTED
                              </span>
                            );
                          }
                          if (s === 'TRAVELLING') {
                            return (
                              <button
                                onClick={() => setSelectedJobForLiveMap(job)}
                                title="Click to view live technician GPS location on map"
                                className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 shadow-md animate-pulse cursor-pointer transition-all"
                              >
                                <MapPin className="w-3.5 h-3.5 text-white" />
                                <span>🚗 TRAVELLING</span>
                              </button>
                            );
                          }
                          if (s === 'ARRIVED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-purple-100 text-purple-900 border-purple-300 shadow-sm">
                                📍 ARRIVED ON SITE
                              </span>
                            );
                          }
                          if (s === 'IN_PROGRESS') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border-amber-300 shadow-sm animate-pulse">
                                🧹 IN PROGRESS
                              </span>
                            );
                          }
                          if (s === 'COMPLETED' || s === 'REPORT_ISSUED' || s === 'CLOSED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-emerald-700 text-white border-emerald-800 shadow-sm">
                                🎉 COMPLETED
                              </span>
                            );
                          }
                          return (
                            <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 border-slate-300">
                              {s.replace(/_/g, ' ')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 align-middle font-semibold text-slate-900 whitespace-nowrap">
                        {job.technicianName && job.technicianName !== 'Unassigned' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="truncate">{job.technicianName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {['TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(job.status) && (
                            <button
                              onClick={() => setSelectedJobForLiveMap(job)}
                              className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-sm border border-indigo-700 inline-flex items-center gap-1 animate-pulse"
                            >
                              <MapPin className="w-3.5 h-3.5 text-white" />
                              <span>Live GPS Map</span>
                            </button>
                          )}

                          <button 
                            onClick={() => setSelectedJobForDetails(job)}
                            className="h-8 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm border border-slate-300 inline-flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#0286cd]" />
                            <span>View Details</span>
                          </button>

                          <button 
                            onClick={() => setSelectedJobForDispatch(job)}
                            className="h-8 bg-[#0286cd] hover:bg-[#026fa8] text-white px-3.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-sm border border-blue-600 inline-flex items-center gap-1"
                          >
                            <span>Dispatch / Assign</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                        No emergency requests found matching the "{dispatchFilter}" status filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* SUB-TAB 2: CUSTOMER ACCOUNTS DIRECTORY */}
      {adminSubTab === 'customers' && (
        <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Registered Business Customer Accounts</h3>
              <p className="text-xs text-slate-600">View membership subscriptions, ABNs, call-out balances, credentials, and inspect account dashboards</p>
            </div>
            <button 
              onClick={() => openCompanyRegistrationModal()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Register Company & Issue Credentials
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                  <th className="py-3 px-4">Business Name & ABN</th>
                  <th className="py-3 px-4">Primary Contact</th>
                  <th className="py-3 px-4">Membership Plan</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Call-outs Used</th>
                  <th className="py-3 px-4">Points Balance</th>
                  <th className="py-3 px-4 text-right">Account Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-50 transition-all">
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{cust.businessName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">ABN: {cust.abn} • {(cust.locations || []).length || 1} Site(s)</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-slate-800 font-medium">{cust.primaryContactName || cust.primaryContact}</div>
                      <div className="text-[10px] text-slate-500">{cust.phoneNumber || cust.phone}</div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-[#0286cd] uppercase">{cust.membershipPlan} Plan</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px]">
                        {cust.paymentMethod}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-extrabold text-slate-800">{cust.calloutsUsed} Used</td>
                    <td className="py-4 px-4 font-bold text-purple-700">{cust.pointsBalance} pts</td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button 
                        onClick={() => handleInspectCustomer(cust.id)}
                        className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 inline-flex cursor-pointer shadow-sm"
                      >
                        <User className="w-3.5 h-3.5" /> Inspect Portal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: TECHNICIAN FLEET MANAGEMENT */}
      {adminSubTab === 'technicians' && (
        <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Field Technician Roster & Status</h3>
              <p className="text-xs text-slate-600">Monitor real-time technician availability, active dispatch jobs, and fleet ratings</p>
            </div>
            <button 
              onClick={() => setShowAddTechModal(true)}
              className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Technician
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {technicians.map(tech => (
              <div key={tech.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={tech.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt={tech.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-300 shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-extrabold text-slate-900 text-sm truncate">{tech.name}</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        tech.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {tech.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-medium">📞 {tech.phone}</div>
                    <div className="text-[11px] text-emerald-700 font-bold">⭐ {tech.rating || 5.0} / 5.0 Rating</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={() => setEditingTech(tech)}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm border border-slate-700"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Edit Technician
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: REWARD POINTS APPROVALS */}
      {adminSubTab === 'points' && (
        <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#0286cd]">Points Redemption Requests Approval Queue</h3>
          <p className="text-xs text-slate-600">Review periodical cleaning requests. Points are deducted from the customer's wallet only upon your approval.</p>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center font-medium">
            No pending redemption requests requiring approval.
          </div>
        </div>
      )}

      {/* SUB-TAB 5: REPORTS & ANALYTICS */}
      {adminSubTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl space-y-2 border border-slate-200 shadow-md">
            <div className="text-xs text-slate-500 uppercase font-extrabold">2-4 Hr SLA Compliance</div>
            <div className="text-3xl font-extrabold text-emerald-600">98.4%</div>
            <p className="text-[11px] text-slate-500">Average response time: 42 mins</p>
          </div>

          <div className="bg-white p-5 rounded-2xl space-y-2 border border-slate-200 shadow-md">
            <div className="text-xs text-slate-500 uppercase font-extrabold">Active Subscriptions</div>
            <div className="text-3xl font-extrabold text-[#0286cd]">{customers.length} Accounts</div>
            <p className="text-[11px] text-slate-500">$18,420 MRR via PayTo Direct</p>
          </div>

          <div className="bg-white p-5 rounded-2xl space-y-2 border border-slate-200 shadow-md">
            <div className="text-xs text-slate-500 uppercase font-extrabold">Total Emergency Call-outs</div>
            <div className="text-3xl font-extrabold text-purple-700">{jobs.length} Requests</div>
            <p className="text-[11px] text-slate-500">0 SLA breaches this month</p>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW TECHNICIAN */}
      {showAddTechModal && (
        <AddTechnicianModal 
          onClose={() => setShowAddTechModal(false)}
          onAdd={async (newTechData) => {
            try {
              const res = await fetch(`${API_BASE}/technicians`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTechData)
              });
              const saved = await res.json();
              if (res.ok && saved.id) {
                const { tempPassword, ...tech } = saved;
                setTechnicians([...technicians, tech]);
                setShowAddTechModal(false);
                if (tempPassword) {
                  alert(`Technician created.\n\nLogin email: ${tech.email}\nTemporary password: ${tempPassword}\n\nGive these to the technician. The password is shown only once.`);
                }
              } else {
                alert(saved.error || 'Failed to add technician. Please check phone and details.');
              }
            } catch (e) {
              alert('Network error: Unable to reach server to register technician.');
            }
          }}
        />
      )}

      {/* MODAL: DISPATCH & ASSIGN TECHNICIAN */}
      {selectedJobForDispatch && (
        <AssignDispatchModal 
          job={selectedJobForDispatch}
          technicians={technicians}
          onClose={() => setSelectedJobForDispatch(null)}
          onAssign={(techName, status) => handleAssignTechnician(selectedJobForDispatch.id, techName, status)}
        />
      )}

      {/* MODAL: LIVE TECHNICIAN GPS LOCATION MAP */}
      {selectedJobForLiveMap && (
        <LiveTechnicianMapModal
          job={selectedJobForLiveMap}
          onClose={() => setSelectedJobForLiveMap(null)}
        />
      )}

      {/* MODAL: INSPECT EMERGENCY REQUEST DETAILS */}
      {selectedJobForDetails && (
        <AdminJobDetailsModal
          job={selectedJobForDetails}
          onClose={() => setSelectedJobForDetails(null)}
          onDispatchClick={(jobToDispatch) => setSelectedJobForDispatch(jobToDispatch)}
        />
      )}

      {/* MODAL: EDIT TECHNICIAN DETAILS */}
      {editingTech && (
        <EditTechnicianModal
          tech={editingTech}
          onClose={() => setEditingTech(null)}
          onSave={async (updatedTech) => {
            try {
              const res = await fetch(`${API_BASE}/technicians/${updatedTech.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTech)
              });
              const saved = await res.json();
              if (res.ok && saved.id) {
                setTechnicians(technicians.map(t => t.id === saved.id ? saved : t));
                setEditingTech(null);
              } else {
                alert(saved.error || 'Failed to update technician.');
              }
            } catch (e) {
              alert('Network error: Unable to reach server to save technician changes.');
            }
          }}
        />
      )}
    </div>
  );
}
