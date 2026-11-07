// App-wide data and session state (was spread through the old App.jsx).
// Pages read it with useAppData() instead of receiving a long list of props.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { API_BASE } from '@/shared/config/env.js';
import { initialCustomerAccounts, initialDynamicConfig, initialTechniciansList } from '@/shared/constants/demoData.js';

const AppDataContext = createContext(null);

const readJson = (key) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
};

export function AppDataProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => readJson('sacc_current_user'));
  const [config, setConfig] = useState(initialDynamicConfig);
  const [customers, setCustomers] = useState(initialCustomerAccounts);
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    const u = readJson('sacc_current_user');
    return u?.businessId || u?.organizationId || 'cust-1';
  });
  const [technicians, setTechnicians] = useState(initialTechniciansList);
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
      if (configData.membershipPlans) setConfig(configData);

      if (!currentUser) return;

      const [custRes, jobsRes] = await Promise.all([fetch(`${API_BASE}/customers`), fetch(`${API_BASE}/jobs`)]);
      const custData = await custRes.json();
      if (custRes.ok && Array.isArray(custData) && custData.length > 0) setCustomers(custData);
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

  const value = useMemo(() => ({
    currentUser, setCurrentUser, config, setConfig, customers, setCustomers, upsertCustomer,
    selectedCustomerId, setSelectedCustomerId, activeCustomer, activePlan,
    technicians, setTechnicians, reloadTechnicians, jobs, setJobs, upsertJob,
    dbStatus, loaded, loadData, login, logout
  }), [currentUser, config, customers, upsertCustomer, selectedCustomerId, activeCustomer, activePlan, technicians, reloadTechnicians, jobs, upsertJob, dbStatus, loaded, loadData, login, logout]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useAppData = () => useContext(AppDataContext);

// Customer-side numbers used on several pages
export function useCustomerSummary() {
  const { activeCustomer: account, activePlan, config, jobs } = useAppData();
  const included = activePlan?.callouts || 2;
  const used = account?.calloutsUsed || 0;
  const remaining = Math.max(0, included - used);
  const customerJobs = jobs.filter(j => j.organizationId === account?.id || j.customerName === account?.businessName);
  return {
    account, activePlan, config, customerJobs,
    included, used, remaining,
    exhausted: remaining <= 0,
    tenureUnlocked: (account?.consecutiveMonths || 0) >= (config.tenureMinMonths || 6),
    cancelled: account?.subscriptionStatus === 'CANCELLED'
  };
}
