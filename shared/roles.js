// Roles and the workspaces each one may open. Shared by the web app and the API.
// The API uses upper case (CUSTOMER); the web app receives lower case (customer) after login.
export const ROLES = { CUSTOMER: 'CUSTOMER', TECHNICIAN: 'TECHNICIAN', ADMIN: 'ADMIN', CONFIG: 'CONFIG' };

export const ROLE_TABS = {
  customer: ['customer'],
  technician: ['technician'],
  config: ['config'],
  admin: ['customer', 'technician', 'admin', 'config']
};

export const ROLE_HOME = { customer: '#customer', technician: '#technician', config: '#config', admin: '#admin/dispatch' };

export const tabForHash = (hash) => {
  if (hash.startsWith('#customer')) return 'customer';
  if (hash.startsWith('#technician')) return 'technician';
  if (hash.startsWith('#config')) return 'config';
  if (hash.startsWith('#admin')) return 'admin';
  return null;
};

export const canOpenHash = (role, hash) => {
  const tab = tabForHash(hash);
  return !tab || (ROLE_TABS[role] || []).includes(tab);
};

// Page paths used by the redesigned web app (React Router). Each role has its own area.
export const ROLE_HOME_PATH = { customer: '/app', technician: '/tech/jobs', config: '/settings/pricing', admin: '/admin/dispatch' };

export const tabForPath = (path) => {
  if (path === '/app' || path.startsWith('/app/')) return 'customer';
  if (path.startsWith('/tech')) return 'technician';
  if (path.startsWith('/settings')) return 'config';
  if (path.startsWith('/admin')) return 'admin';
  return null;
};

export const canOpenPath = (role, path) => {
  const tab = tabForPath(path);
  return !tab || (ROLE_TABS[role] || []).includes(tab);
};

// Old hash links (#customer/profile …) and where they live now
export const LEGACY_HASH_PATHS = {
  '#login': '/login',
  '#register': '/register',
  '#customer': '/app',
  '#customer/request': '/app/requests/new',
  '#customer/points': '/app/rewards',
  '#customer/profile': '/app/account/profile',
  '#customer/cancel': '/app/membership/cancel',
  '#customer/callouts': '/app/membership',
  '#technician': '/tech/jobs',
  '#admin': '/admin/dispatch',
  '#admin/dispatch': '/admin/dispatch',
  '#admin/customers': '/admin/customers',
  '#admin/register-company': '/admin/customers/new',
  '#admin/technicians': '/admin/technicians',
  '#admin/points': '/admin/rewards',
  '#admin/reports': '/admin/reports',
  '#admin/hotline': '/admin/hotline',
  '#config': '/settings/pricing'
};
