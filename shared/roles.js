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
