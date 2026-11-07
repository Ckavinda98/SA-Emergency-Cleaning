// App-wide data and session state (was spread through the old App.jsx).
// Pages read it with useAppData() instead of receiving a long list of props.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { API_BASE } from '@/shared/config/env.js';

const AppDataContext = createContext(null);

// Empty until /api/config answers. Every value shown in the app comes from the database.
const EMPTY_CONFIG = { membershipPlans: [], redemptionServices: [], incidentCategories: [], additionalCalloutFee: 0, tenureMinMonths: 0, toiletOverflowDisclaimer: '', publicHolidays: [], loyaltyLevels: [], multiSiteDiscounts: [] };

// Jobs store the technician's name; older rows add a suffix ("Dave Miller (Tech ID #104)")
export const isTechniciansJob = (job, tech) => {
  if (!job?.technicianName || !tech?.name) return false;
  const a = job.technicianName.toLowerCase(), b = tech.name.toLowerCase();
  return a === b || a.startsWith(`${b} (`);
};

const readJson = (key) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
};

export function AppDataProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => readJson('sacc_current_user'));
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [customers, setCustomers] = useState([]);
  // Which customer / technician an admin is looking at in the customer and technician views (remembered per browser)
  const [selectedCustomerId, setSelectedCustomerIdState] = useState(() => {
    const u = readJson('sacc_current_user');
    return u?.businessId || u?.organizationId || readJson('sacc_view_customer') || null;
  });
  const [selectedTechnicianId, setSelectedTechnicianIdState] = useState(() => readJson('sacc_view_technician'));
  const setSelectedCustomerId = useCallback((id) => { setSelectedCustomerIdState(id); try { localStorage.setItem('sacc_view_customer', JSON.stringify(id)); } catch { /* ignore */ } }, []);
  const setSelectedTechnicianId = useCallback((id) => { setSelectedTechnicianIdState(id); try { localStorage.setItem('sacc_view_technician', JSON.stringify(id)); } catch { /* ignore */ } }, []);
  const [technicians, setTechnicians] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [dbStatus, setDbStatus] = useState('CONNECTING...');
  const [loaded, setLoaded] = useState(false);

  // The fetch interceptor fires this when the refresh token is rejected
  useEffect(() => {
    const onSessionEnded = () => setCurrentUser(null);
    window.addEventListener('sacc:session-ended', onSessionEnded);
    return () => window.removeEventListener('sacc:session-ended', onSessionEnded);
  }, []);

  useEffect(() => {
    if (currentUser) localStorage.setItem('sacc_current_user', JSON.stringify(currentUser));
    else localStorage.removeItem('sacc_current_user');
  }, [currentUser]);

  const loadData = useCallback(async () => {
    try {
      const healthRes = await fetch(`${API_BASE}/health`);
      const healthData = await healthRes.json();
      if (healthData.status === 'ONLINE') setDbStatus('ONLINE');

      const configRes = await fetch(`${API_BASE}/config`);
      const configData = await configRes.json();
      if (configData.membershipPlans) { setConfig(configData); setConfigLoaded(true); }

      if (!currentUser) return;

      const [custRes, jobsRes] = await Promise.all([fetch(`${API_BASE}/customers`), fetch(`${API_BASE}/jobs`)]);
      const custData = await custRes.json();
      if (custRes.ok && Array.isArray(custData)) setCustomers(custData);
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
    } finally {
      setLoaded(true);
    }
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  // Keep the in-progress timer moving on technician screens
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prev => prev.map(job => (job.status === 'IN_PROGRESS' && job.workStartedAt)
        ? { ...job, timerMinutes: Math.max(0, Math.floor((Date.now() - new Date(job.workStartedAt).getTime()) / 60000)) }
        : job));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const login = useCallback(async (user, accessToken, refreshToken) => {
    if (accessToken) await Preferences.set({ key: 'sacc_access_token', value: accessToken });
    if (refreshToken) await Preferences.set({ key: 'sacc_refresh_token', value: refreshToken });
    if (user.businessId) setSelectedCustomerId(user.businessId);
    else if (user.organizationId) setSelectedCustomerId(user.organizationId);
    setLoaded(false);
    setCurrentUser(user);
  }, []);

  const logout = useCallback(async () => {
    try { await fetch(`${API_BASE}/auth/logout`, { method: 'POST' }); } catch (e) { console.warn('Logout could not reach the server:', e); }
    try {
      localStorage.removeItem('sacc_current_user');
      await Preferences.remove({ key: 'sacc_access_token' });
      await Preferences.remove({ key: 'sacc_refresh_token' });
    } catch (e) { /* ignore */ }
    setCurrentUser(null);
    setJobs([]);
    setCustomers([]);
    setTechnicians([]);
  }, []);

  const upsertCustomer = useCallback((c) => {
    setCustomers(prev => prev.some(x => x.id === c.id) ? prev.map(x => x.id === c.id ? { ...x, ...c } : x) : [c, ...prev]);
  }, []);
  const upsertJob = useCallback((j) => {
    setJobs(prev => prev.some(x => x.id === j.id) ? prev.map(x => x.id === j.id ? j : x) : [j, ...prev]);
  }, []);
  const reloadTechnicians = useCallback(async () => {
    const res = await fetch(`${API_BASE}/technicians`);
    if (res.ok) setTechnicians(await res.json());
  }, []);

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];
  const activePlan = config.membershipPlans.find(p => p.id === activeCustomer?.membershipPlan) || config.membershipPlans[1];
  // The technician whose jobs the technician view shows: yourself, or the one an admin picked
  const activeTechnician = currentUser?.role === 'technician'
    ? technicians.find(t => t.id === currentUser.technicianId || t.id === currentUser.techId) || technicians.find(t => t.name === currentUser.name)
    : technicians.find(t => t.id === selectedTechnicianId) || technicians[0];

  const value = useMemo(() => ({
    currentUser, setCurrentUser, config, setConfig, configLoaded, customers, setCustomers, upsertCustomer,
    selectedCustomerId, setSelectedCustomerId, activeCustomer, activePlan,
    selectedTechnicianId, setSelectedTechnicianId, activeTechnician,
    technicians, setTechnicians, reloadTechnicians, jobs, setJobs, upsertJob,
    dbStatus, loaded, loadData, login, logout
  }), [currentUser, config, configLoaded, customers, upsertCustomer, selectedCustomerId, setSelectedCustomerId, activeCustomer, activePlan,
    selectedTechnicianId, setSelectedTechnicianId, activeTechnician, technicians, reloadTechnicians, jobs, upsertJob, dbStatus, loaded, loadData, login, logout]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useAppData = () => useContext(AppDataContext);

// Customer-side numbers used on several pages. The server works them out from the Agreement rules
// (customer.membership), so every page shows the same figures.
export function useCustomerSummary() {
  const { activeCustomer: account, activePlan, config, jobs } = useAppData();
  const m = account?.membership || {};
  const included = m.included ?? activePlan?.callouts ?? 0;
  const used = m.used ?? account?.calloutsUsed ?? 0;
  const remaining = m.remaining ?? Math.max(0, included - used);
  const customerJobs = jobs.filter(j => j.organizationId === account?.id || j.customerName === account?.businessName);
  return {
    account, activePlan, config, customerJobs, membership: m,
    included, used, remaining,
    exhausted: remaining <= 0,
    labourRate: m.labourRate ?? activePlan?.labourRate,
    tenureUnlocked: Boolean(m.redeemUnlocked),
    cancelled: account?.subscriptionStatus === 'CANCELLED',
    suspended: account?.subscriptionStatus === 'SUSPENDED'
  };
}
