// API client: every fetch to API_BASE gets the access token, and a 401 triggers one refresh-token
// rotation and a retry. If the refresh fails the session ends and the app goes back to /login.
// Installed once from main.jsx, so components keep calling fetch(`${API_BASE}/...`) as before.
import { Preferences } from '@capacitor/preferences';
import { API_BASE } from '@/shared/config/env.js';

export const TOKEN_KEYS = { access: 'sacc_access_token', refresh: 'sacc_refresh_token' };

let installed = false;

export function installAuthFetch() {
  if (installed) return;
  installed = true;
  const originalFetch = window.fetch;
    window.fetch = async (...args) => {
    let [resource, config] = args;
  
    if (typeof resource === 'string' && resource.startsWith(API_BASE)) {
      const { value: accessToken } = await Preferences.get({ key: 'sacc_access_token' });
      if (accessToken) {
        config = config || {};
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${accessToken}`
        };
      }
    }

    let response = await originalFetch(resource, config);

    if (response.status === 401 && typeof resource === 'string' && resource.startsWith(API_BASE) &&
        !resource.includes('/auth/login') && !resource.includes('/auth/register') && !resource.includes('/auth/refresh')) {
      config = config || {};
      const { value: refreshToken } = await Preferences.get({ key: 'sacc_refresh_token' });
      if (refreshToken) {
        const refreshRes = await originalFetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshRes.ok) {
          const { accessToken: newAccess, refreshToken: newRefresh } = await refreshRes.json();
          await Preferences.set({ key: 'sacc_access_token', value: newAccess });
          await Preferences.set({ key: 'sacc_refresh_token', value: newRefresh });
        
          config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${newAccess}`
          };
          response = await originalFetch(resource, config);
        } else {
          localStorage.removeItem('sacc_current_user');
          await Preferences.remove({ key: 'sacc_access_token' });
          await Preferences.remove({ key: 'sacc_refresh_token' });
          window.dispatchEvent(new Event('sacc:session-ended'));
        }
      } else {
        localStorage.removeItem('sacc_current_user');
        window.dispatchEvent(new Event('sacc:session-ended'));
      }
    }
    return response;
  };
}
