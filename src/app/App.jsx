import React, { useState, useEffect, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import {
  ShieldAlert, User, Building, Wrench, Settings, X, ChevronDown, Menu, LogOut
} from 'lucide-react';
import { NavigationSidebarDrawer } from '@/app/layout/NavigationSidebarDrawer.jsx';
import { AdminOperationsHub } from '@/features/admin';
import { CompanyRegistrationModal, LoginPortal } from '@/features/auth';
import { DynamicConfigStudio } from '@/features/config';
import { CalloutExplanationModal, CancelSubscriptionModal, ChangePlanModal, CompanyProfileModal, CustomerPortal, PointsRedemptionModal } from '@/features/customer';
import { EditEmergencyRequestModal, HotlineBookingModal, NewEmergencyRequestModal } from '@/features/jobs';
import { TechnicianApp } from '@/features/technician';
import { API_BASE } from '@/shared/config/env.js';
import { initialCustomerAccounts, initialDynamicConfig, initialTechniciansList } from '@/shared/constants/demoData.js';
import { ROLE_HOME, ROLE_TABS, canOpenHash } from '@shared/roles.js';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sacc_current_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('sacc_active_tab');
      if (saved) return saved;
    } catch (e) {}
    return 'customer';
  });
  const [adminSubTab, setAdminSubTab] = useState('dispatch');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const saved = localStorage.getItem('sacc_current_user');
      if (!saved) return (hash === '#register' ? '#register' : '#login');
      return hash || '#customer';
    }
    return '#login';
  });

  const navigateTo = (hash) => {
    window.location.hash = hash;
  };

  const [config, setConfig] = useState(initialDynamicConfig);
  const [customerAccounts, setCustomerAccounts] = useState(initialCustomerAccounts);
  const [selectedCustomerId, setSelectedCustomerId] = useState('cust-1');
  const [technicians, setTechnicians] = useState(initialTechniciansList);
  const [jobs, setJobs] = useState([]);
  const [dbStatus, setDbStatus] = useState('CONNECTING...');
  
  // Modals & UI States
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showHotlineModal, setShowHotlineModal] = useState(false);
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [showCalloutExplanationModal, setShowCalloutExplanationModal] = useState(false);

  // Registration & Account Management Modals
  const [showCompanyRegistrationModal, setShowCompanyRegistrationModal] = useState(false);
  const [registrationModalMode, setRegistrationModalMode] = useState('public'); // 'public' or 'admin'
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCancelSubscriptionModal, setShowCancelSubscriptionModal] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [showTechSettingsMenu, setShowTechSettingsMenu] = useState(false);
  const [showTechProfileModal, setShowTechProfileModal] = useState(false);

  // The fetch interceptor fires this when the refresh token is rejected
  useEffect(() => {
    const onSessionEnded = () => setCurrentUser(null);
    window.addEventListener('sacc:session-ended', onSessionEnded);
    return () => window.removeEventListener('sacc:session-ended', onSessionEnded);
  }, []);

  // Save session state to localStorage on updates
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sacc_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('sacc_current_user');
      localStorage.removeItem('sacc_active_tab');
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab && currentUser) {
      localStorage.setItem('sacc_active_tab', activeTab);
    }
  }, [activeTab, currentUser]);

  // Hash-based Browser Routing Engine.
  // The listener reads the user from a ref, so a hash change fired right after login sees the new user.
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  useEffect(() => {
    const handleHashChange = () => {
      const user = currentUserRef.current;
      const hash = window.location.hash || (user ? (ROLE_HOME[user.role] || '#customer') : '#login');
      setCurrentHash(hash);

      if (!user) {
        if (hash !== '#login' && hash !== '#register') {
          window.location.hash = '#login';
        }
        return;
      }

      // Already signed in: the login page sends you to your own workspace
      if (hash === '#login') {
        setShowCompanyRegistrationModal(false);
        window.location.hash = ROLE_HOME[user.role] || '#customer';
        return;
      }

      if (hash === '#register') {
        setRegistrationModalMode('public');
        setShowCompanyRegistrationModal(true);
        return;
      }

      // A role can only open its own workspaces, whatever the URL says
      if (!canOpenHash(user.role, hash)) {
        window.location.hash = ROLE_HOME[user.role] || '#login';
        return;
      }

      // Sync Modals
      setShowNewRequestModal(hash === '#customer/request');
      setShowRedemptionModal(hash === '#customer/points');
      setShowProfileModal(hash === '#customer/profile');
      setShowCancelSubscriptionModal(hash === '#customer/cancel');
      setShowCalloutExplanationModal(hash === '#customer/callouts');
      setShowHotlineModal(hash === '#admin/hotline');

      if (hash.startsWith('#customer')) {
        setActiveTab('customer');
      } else if (hash.startsWith('#technician')) {
        setActiveTab('technician');
      } else if (hash.startsWith('#config')) {
        setActiveTab('config');
      } else if (hash.startsWith('#admin')) {
        setActiveTab('admin');
        if (hash === '#admin/customers') setAdminSubTab('customers');
        else if (hash === '#admin/technicians') setAdminSubTab('technicians');
        else if (hash === '#admin/points') setAdminSubTab('points');
        else if (hash === '#admin/reports') setAdminSubTab('reports');
        else if (hash === '#admin/register-company') {
          setAdminSubTab('customers');
          setRegistrationModalMode('admin');
          setShowCompanyRegistrationModal(true);
        } else {
          setAdminSubTab('dispatch');
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser]);

  // Fetch Real Data from Backend API Server (runs again whenever a different user signs in)
  const loadData = async () => {
    try {
      const healthRes = await fetch(`${API_BASE}/health`);
      const healthData = await healthRes.json();
      if (healthData.status === 'ONLINE') {
        setDbStatus('ONLINE (Azure/SQLite DB)');
      }

      const configRes = await fetch(`${API_BASE}/config`);
      const configData = await configRes.json();
      if (configData.membershipPlans) setConfig(configData);

      // Everything below needs a signed-in user
      if (!currentUser) return;

      const custRes = await fetch(`${API_BASE}/customers`);
      const custData = await custRes.json();
      if (custRes.ok && Array.isArray(custData) && custData.length > 0) setCustomerAccounts(custData);

      const jobsRes = await fetch(`${API_BASE}/jobs`);
      const jobsData = await jobsRes.json();
      if (jobsRes.ok && Array.isArray(jobsData)) setJobs(jobsData);

      if (['admin', 'technician', 'config'].includes(currentUser.role)) {
        const techRes = await fetch(`${API_BASE}/technicians`);
        const techData = await techRes.json();
        if (techRes.ok && Array.isArray(techData)) setTechnicians(techData);
      }
    } catch (err) {
      console.warn('Backend API server offline.', err);
      setDbStatus('OFFLINE');
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  const activeCustomer = customerAccounts.find(c => c.id === selectedCustomerId) || customerAccounts[0];
  const activeJob = jobs[0];
  const activePlan = config.membershipPlans.find(p => p.id === activeCustomer.membershipPlan) || config.membershipPlans[1];

  // Handle Login Event
  const handleLogin = async (user, accessToken, refreshToken) => {
    if (accessToken) await Preferences.set({ key: 'sacc_access_token', value: accessToken });
    if (refreshToken) await Preferences.set({ key: 'sacc_refresh_token', value: refreshToken });
    
    setCurrentUser(user);
    if (user.businessId) setSelectedCustomerId(user.businessId);
    else if (user.organizationId) setSelectedCustomerId(user.organizationId);
    
    // Routing relies strictly on the authenticated credential role returned by the server
    const role = (user.role || '').toLowerCase();
    if (role === 'customer') {
      setActiveTab('customer');
      navigateTo('#customer');
    } else if (role === 'technician') {
      setActiveTab('technician');
      navigateTo('#technician');
    } else if (role === 'config') {
      setActiveTab('config');
      navigateTo('#config');
    } else {
      setActiveTab('admin');
      navigateTo('#admin/dispatch');
    }
  };

  // Handle Logout Event
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch (e) {
      console.warn('Logout could not reach the server:', e);
    }
    try {
      localStorage.removeItem('sacc_current_user');
      localStorage.removeItem('sacc_active_tab');
      await Preferences.remove({ key: 'sacc_access_token' });
      await Preferences.remove({ key: 'sacc_refresh_token' });
    } catch (e) {}
    setCurrentUser(null);
    navigateTo('#login');
  };

  // Handle Registration Success
  const handleRegisterSuccess = async (newCustomer, payload) => {
    setCustomerAccounts([newCustomer, ...customerAccounts]);
    setSelectedCustomerId(newCustomer.id);
    setShowCompanyRegistrationModal(false);

    if (registrationModalMode === 'public') {
      // Sign the new company in through the normal login so it gets real tokens
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: payload.email, password: payload.password })
        });
        const data = await res.json();
        if (res.ok && data.user) {
          await handleLogin(data.user, data.accessToken, data.refreshToken);
        } else {
          navigateTo('#login');
        }
      } catch (e) {
        navigateTo('#login');
      }
    }
  };

  // Handle Profile Update Success
  const handleProfileUpdateSuccess = (updatedCustomer) => {
    setCustomerAccounts(customerAccounts.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    setShowProfileModal(false);
  };

  // Handle Subscription Cancellation Success
  const handleSubscriptionCancelSuccess = (updatedCustomer) => {
    setCustomerAccounts(customerAccounts.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    setShowCancelSubscriptionModal(false);
  };

  // Open Registration Modal Helper
  const openPublicRegistrationModal = () => {
    setRegistrationModalMode('public');
    setShowCompanyRegistrationModal(true);
  };

  const openAdminRegistrationModal = () => {
    setRegistrationModalMode('admin');
    setShowCompanyRegistrationModal(true);
  };

  // Timer Tick Engine for Technician View
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prevJobs => prevJobs.map(job => {
        if (job.status === 'IN_PROGRESS' && job.workStartedAt) {
          return { ...job, timerMinutes: Math.max(0, Math.floor((Date.now() - new Date(job.workStartedAt).getTime()) / 60000)) };
        }
        return job;
      }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // 1. UNAUTHENTICATED STATE: Render Login Portal Screen (No sidebar/hamburger button on login or register)
  if (!currentUser) {
    return (
      <>
        <LoginPortal 
          onLogin={handleLogin} 
          dbStatus={dbStatus} 
          customerAccounts={customerAccounts} 
          onOpenRegister={openPublicRegistrationModal}
        />
        {showCompanyRegistrationModal && (
          <CompanyRegistrationModal 
            onClose={() => setShowCompanyRegistrationModal(false)}
            onRegisterSuccess={handleRegisterSuccess}
            isAdminMode={false}
            config={config}
          />
        )}
      </>
    );
  }

  // Each role may only open its own workspaces, whatever the URL or saved tab says
  const allowedTabs = ROLE_TABS[currentUser.role] || [];
  const visibleTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];

  // 2. AUTHENTICATED STATE: Render Main Application with Navigation Header
  return (
    <div className="min-h-screen text-slate-800 flex flex-col login-card-gradient">
      {/* Left-Side Drawer: Expands when clicking 3-stripe button */}
      <NavigationSidebarDrawer 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        currentHash={currentHash} 
        navigateTo={navigateTo}
        currentUser={currentUser}
      />

      {/* Top Header with 3-Stripe Hamburger Menu & Universal Top-Right Log Out Button */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: 3-Stripe Hamburger Menu Button + Logo + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle navigation drawer"
            className="p-2.5 rounded-xl text-slate-700 hover:text-[#0286cd] hover:bg-blue-50 border border-slate-300 transition-all cursor-pointer shadow-sm flex items-center justify-center"
            title={isSidebarOpen ? "Close Navigation Menu" : "Open Navigation Menu"}
          >
            <Menu className="w-5 h-5 text-slate-800" />
          </button>

          <div className="bg-[#e4e4e4] p-2 rounded-xl shadow-sm border border-slate-300 flex items-center justify-center">
            <img src="/logo.webp" alt="SA Commercial Cleaning Services" className="h-9 w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
              SA Emergency Cleaning
            </h1>
            <p className="text-[11px] text-[#0286cd] font-semibold">SA Emergency Cleaning Pty Ltd • 24/7 Response Desk</p>
          </div>
        </div>

        {/* Top Right Corner: Account Selector + User Badge + Universal Log Out Button for All User Types */}
        <div className="flex items-center gap-3">
          {/* Customer Account Selector Dropdown (Shown for Admin role) */}
          {(currentUser.role === 'admin') && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3.5 py-1.5 rounded-xl shadow-sm">
              <Building className="w-4 h-4 text-[#0286cd]" />
              <div className="text-left">
                <div className="text-[9px] text-slate-500 uppercase font-extrabold">Active Business Account:</div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-[#0286cd] focus:outline-none cursor-pointer"
                >
                  {customerAccounts.map(c => (
                    <option key={c.id} value={c.id} className="bg-white text-slate-900 font-medium">
                      {c.businessName} ({c.membershipPlan.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* User Badge / Info Pill */}
          <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
            <div className="w-7 h-7 rounded-full bg-[#0286cd] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
              {currentUser.name ? currentUser.name.charAt(0) : 'U'}
            </div>
            <div className="text-left leading-tight">
              <div className="text-xs font-black text-slate-900 truncate max-w-[130px]">{currentUser.name}</div>
              <div className="text-[10px] font-extrabold text-[#0286cd] uppercase">{currentUser.role}</div>
            </div>
          </div>

          {/* Technician Settings Gear Icon Dropdown (Shown for Technician role) */}
          {(currentUser.role === 'technician') && (
            <div className="relative">
              <button
                onClick={() => setShowTechSettingsMenu(!showTechSettingsMenu)}
                className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 transition-all cursor-pointer shadow-sm flex items-center gap-2 font-bold text-xs"
              >
                <Settings className="w-4 h-4 text-[#0286cd]" />
                <span className="hidden sm:inline">Settings</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {showTechSettingsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-xs">
                  <button
                    onClick={() => { setShowTechSettingsMenu(false); setShowTechProfileModal(true); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-800"
                  >
                    <User className="w-4 h-4 text-[#0286cd]" />
                    <span>Profile</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* UNIVERSAL LOG OUT BUTTON FOR EACH USER TYPE */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 font-extrabold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
            title="Log Out of System"
          >
            <LogOut className="w-4 h-4 text-red-500 shrink-0" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {/* NATIVE ANDROID MOBILE TOUCH BOTTOM NAVIGATION BAR (Admin Only) */}
      {currentUser.role === 'admin' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2 flex justify-around shadow-2xl text-slate-700">
          {(currentUser.role === 'admin') && (
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
                activeTab === 'customer' ? 'text-[#0286cd] font-extrabold bg-[#0286cd]/10 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Customer</span>
            </button>
          )}

          {(currentUser.role === 'technician' || currentUser.role === 'admin') && (
            <button
              onClick={() => setActiveTab('technician')}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
                activeTab === 'technician' ? 'text-[#0286cd] font-extrabold bg-[#0286cd]/10 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Wrench className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Technician</span>
            </button>
          )}

          {(currentUser.role === 'admin') && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
                activeTab === 'admin' ? 'text-[#0286cd] font-extrabold bg-[#0286cd]/10 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Admin Ops</span>
            </button>
          )}

          {(currentUser.role === 'config' || currentUser.role === 'admin') && (
            <button
              onClick={() => setActiveTab('config')}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
                activeTab === 'config' ? 'text-emerald-600 font-extrabold bg-emerald-50 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Config</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer text-red-500 hover:bg-red-50 font-medium"
          >
            <X className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Log Out</span>
          </button>
        </div>
      )}

      {/* Main App Body */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-8 pb-32">
        {/* CUSTOMER PORTAL VIEW */}
        {visibleTab === 'customer' && (
          <CustomerPortal 
            account={activeCustomer} 
            activePlan={activePlan} 
            config={config} 
            jobs={jobs}
            setJobs={setJobs}
            setShowNewRequestModal={setShowNewRequestModal}
            setShowRedemptionModal={setShowRedemptionModal}
            setShowCalloutExplanationModal={setShowCalloutExplanationModal}
            setShowProfileModal={setShowProfileModal}
            setShowCancelSubscriptionModal={setShowCancelSubscriptionModal}
            setShowChangePlanModal={setShowChangePlanModal}
            setEditingJob={setEditingJob}
            handleLogout={handleLogout}
          />
        )}

        {/* TECHNICIAN MOBILE APP VIEW */}
        {visibleTab === 'technician' && (
          <TechnicianApp 
            jobs={jobs}
            setJobs={setJobs}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            handleLogout={handleLogout}
            showProfileModal={showTechProfileModal}
            setShowProfileModal={setShowTechProfileModal}
          />
        )}

        {/* ADMIN OPERATIONS & ACCOUNTS HUB VIEW */}
        {visibleTab === 'admin' && (
          <AdminOperationsHub 
            jobs={jobs}
            setJobs={setJobs}
            config={config}
            customers={customerAccounts}
            setCustomers={setCustomerAccounts}
            setSelectedCustomerId={setSelectedCustomerId}
            setActiveTab={setActiveTab}
            technicians={technicians}
            setTechnicians={setTechnicians}
            setShowHotlineModal={setShowHotlineModal}
            openCompanyRegistrationModal={openAdminRegistrationModal}
            adminSubTab={adminSubTab}
            setAdminSubTab={setAdminSubTab}
          />
        )}

        {/* DYNAMIC ADMIN CONFIG STUDIO */}
        {visibleTab === 'config' && (
          <DynamicConfigStudio 
            config={config}
            setConfig={setConfig}
          />
        )}
      </main>

      {/* MODALS */}
      {showCompanyRegistrationModal && (
        <CompanyRegistrationModal 
          onClose={() => setShowCompanyRegistrationModal(false)}
          onRegisterSuccess={handleRegisterSuccess}
          isAdminMode={registrationModalMode === 'admin'}
          config={config}
        />
      )}

      {showProfileModal && (
        <CompanyProfileModal 
          account={activeCustomer}
          onClose={() => setShowProfileModal(false)}
          onUpdateSuccess={handleProfileUpdateSuccess}
          onSitesChanged={(updated) => setCustomerAccounts(prev => prev.map(c => c.id === updated.id ? updated : c))}
          handleLogout={handleLogout}
        />
      )}

      {showCancelSubscriptionModal && (
        <CancelSubscriptionModal 
          account={activeCustomer}
          onClose={() => setShowCancelSubscriptionModal(false)}
          onCancelSuccess={handleSubscriptionCancelSuccess}
        />
      )}

      {showChangePlanModal && (
        <ChangePlanModal 
          account={activeCustomer}
          activePlan={activePlan}
          config={config}
          onClose={() => setShowChangePlanModal(false)}
          onPlanChangeSuccess={(updatedCustomer) => {
            setCustomerAccounts(customerAccounts.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
            setShowChangePlanModal(false);
          }}
        />
      )}

      {showNewRequestModal && (
        <NewEmergencyRequestModal 
          account={activeCustomer}
          config={config}
          onClose={() => setShowNewRequestModal(false)}
          onSubmit={async (newJobData) => {
            try {
              const res = await fetch(`${API_BASE}/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newJobData)
              });
              const data = await res.json();
              if (!res.ok || data.error) {
                alert(data.error || 'The emergency request could not be submitted.');
                // Offer a plan upgrade only when the call-out allowance is used up
                if ((data.error || '').includes('Call-out Limit')) {
                  setShowNewRequestModal(false);
                  setShowChangePlanModal(true);
                }
                return;
              }
              setJobs([data, ...jobs]);
              setCustomerAccounts(customerAccounts.map(c => c.id === activeCustomer.id ? { ...c, calloutsUsed: (c.calloutsUsed || 0) + 1 } : c));
            } catch (err) {
              alert('Network error: Unable to submit emergency request to server.');
            }
            setShowNewRequestModal(false);
          }}
        />
      )}

      {editingJob && (
        <EditEmergencyRequestModal
          job={editingJob}
          account={activeCustomer}
          config={config}
          onClose={() => setEditingJob(null)}
          onSave={async (updatedFields) => {
            try {
              const res = await fetch(`${API_BASE}/jobs/${editingJob.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedFields)
              });
              const data = await res.json();
              if (!res.ok || data.error) {
                alert(data.error || 'Failed to update request.');
                return;
              }
              setJobs(jobs.map(j => j.id === editingJob.id ? data : j));
              setEditingJob(null);
            } catch (err) {
              alert('Network error: Unable to save your changes to the server. Nothing was changed.');
            }
          }}
        />
      )}

      {showHotlineModal && (
        <HotlineBookingModal 
          account={activeCustomer}
          customerAccounts={customerAccounts}
          config={config}
          onClose={() => setShowHotlineModal(false)}
          onSubmit={async (newJobData) => {
            try {
              const res = await fetch(`${API_BASE}/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newJobData)
              });
              const data = await res.json();
              if (res.ok && data.id) {
                setJobs([data, ...jobs]);
                setShowHotlineModal(false);
              } else {
                alert(data.error || 'Failed to submit hotline booking.');
              }
            } catch (err) {
              alert('Network error: Unable to submit hotline booking to server.');
            }
          }}
        />
      )}

      {showRedemptionModal && (
        <PointsRedemptionModal 
          account={activeCustomer}
          config={config}
          onClose={() => setShowRedemptionModal(false)}
        />
      )}

      {showCalloutExplanationModal && (
        <CalloutExplanationModal 
          account={activeCustomer}
          activePlan={activePlan}
          config={config}
          onClose={() => setShowCalloutExplanationModal(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900/80 py-6 px-4 text-center text-xs text-slate-500">
        <p>© 2026 SA Commercial Cleaning Services Pty Ltd (SACC). All rights reserved.</p>
        <p className="mt-1 text-cyan-400/60">Target Emergency Attendance Time: 2–4 hours from validated request timestamp. Azure Cloud Australia East (Sydney).</p>
      </footer>
    </div>
  );
}
