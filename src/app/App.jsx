// Routes for every page. Each role has its own area (/app, /tech, /admin, /settings) inside the app shell.
// Old hash links (#customer/profile …) are redirected to the new paths so bookmarks keep working.
import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppDataProvider, useAppData } from '@/app/AppData.jsx';
import { AppShell } from '@/app/layout/AppShell.jsx';
import { ToastProvider } from '@/shared/ui/index.jsx';
import { ROLE_HOME_PATH, canOpenPath, LEGACY_HASH_PATHS } from '@shared/roles.js';

import { LoginPage, RegisterPage } from '@/features/auth';
import {
  CustomerDashboard, RequestsPage, RequestDetailPage, RequestFormPage, RewardsPage,
  MembershipPage, ChangePlanPage, CancelMembershipPage, AccountPage, ServiceReportPage
} from '@/features/customer';
import { TechJobsPage, TechJobDetailPage, TechHistoryPage, TechProfilePage } from '@/features/technician';
import {
  DispatchPage, AdminJobPage, LiveMapPage, CustomersPage, CustomerDetailPage, AdminRegisterCompanyPage,
  TechniciansPage, TechnicianFormPage, RewardsQueuePage, ReportsPage, HotlinePage
} from '@/features/admin';
import { SettingsPage } from '@/features/config';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppDataProvider>
          <LegacyHashRedirect />
          <Routes>
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/register/*" element={<PublicOnly><RegisterPage /></PublicOnly>} />

            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/" element={<HomeRedirect />} />

              <Route path="/app" element={<Outlet />}>
                <Route index element={<CustomerDashboard />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="requests/new" element={<RequestFormPage />} />
                <Route path="requests/:jobId" element={<RequestDetailPage />} />
                <Route path="requests/:jobId/edit" element={<RequestFormPage />} />
                <Route path="requests/:jobId/report" element={<ServiceReportPage />} />
                <Route path="rewards" element={<RewardsPage />} />
                <Route path="membership" element={<MembershipPage />} />
                <Route path="membership/change" element={<ChangePlanPage />} />
                <Route path="membership/cancel" element={<CancelMembershipPage />} />
                <Route path="account" element={<Navigate to="/app/account/profile" replace />} />
                <Route path="account/:section" element={<AccountPage />} />
              </Route>

              <Route path="/tech" element={<Outlet />}>
                <Route index element={<Navigate to="/tech/jobs" replace />} />
                <Route path="jobs" element={<TechJobsPage />} />
                <Route path="jobs/:jobId" element={<TechJobDetailPage />} />
                <Route path="jobs/:jobId/report" element={<ServiceReportPage />} />
                <Route path="history" element={<TechHistoryPage />} />
                <Route path="profile" element={<TechProfilePage />} />
              </Route>

              <Route path="/admin" element={<Outlet />}>
                <Route index element={<Navigate to="/admin/dispatch" replace />} />
                <Route path="dispatch" element={<DispatchPage />} />
                <Route path="jobs/:jobId" element={<AdminJobPage />} />
                <Route path="jobs/:jobId/report" element={<ServiceReportPage />} />
                <Route path="map" element={<LiveMapPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/new/*" element={<AdminRegisterCompanyPage />} />
                <Route path="customers/:customerId" element={<CustomerDetailPage />} />
                <Route path="technicians" element={<TechniciansPage />} />
                <Route path="technicians/new" element={<TechnicianFormPage />} />
                <Route path="technicians/:techId" element={<TechnicianFormPage />} />
                <Route path="rewards" element={<RewardsQueuePage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="hotline" element={<HotlinePage />} />
              </Route>

              <Route path="/settings" element={<Outlet />}>
                <Route index element={<Navigate to="/settings/pricing" replace />} />
                <Route path=":section" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<HomeRedirect />} />
            </Route>
          </Routes>
        </AppDataProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

function HomeRedirect() {
  const { currentUser } = useAppData();
  return <Navigate to={ROLE_HOME_PATH[currentUser?.role] || '/login'} replace />;
}

// Signed-in only, and only the pages this role may open
function RequireAuth({ children }) {
  const { currentUser } = useAppData();
  const location = useLocation();
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canOpenPath(currentUser.role, location.pathname)) return <Navigate to={ROLE_HOME_PATH[currentUser.role] || '/login'} replace />;
  return children;
}

function PublicOnly({ children }) {
  const { currentUser } = useAppData();
  if (currentUser) return <Navigate to={ROLE_HOME_PATH[currentUser.role] || '/'} replace />;
  return children;
}

function LegacyHashRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const go = () => {
      const hash = window.location.hash;
      if (!hash || hash === '#') return;
      const target = LEGACY_HASH_PATHS[hash];
      if (target) navigate(target, { replace: true });
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, [navigate]);
  return null;
}
