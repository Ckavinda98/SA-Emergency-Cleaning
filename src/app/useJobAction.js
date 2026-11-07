import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { useToast } from '@/shared/ui/index.jsx';

// Calls a job action on the API and puts the updated job into the app's data
export function useJobAction() {
  const { upsertJob, loadData } = useAppData();
  const { notify } = useToast();
  return async (job, path, body, done) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${job.id}/${path}`, { method: path === 'site' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'That did not work.', 'danger'); return null; }
      upsertJob(data);
      if (done) notify(done);
      if (['triage', 'cancel', 'quote', 'missed-access', 'report', 'goodwill', 'reattend', 'reclassify'].includes(path)) loadData();
      return data;
    } catch {
      notify('Cannot reach the server. Nothing was changed.', 'danger');
      return null;
    }
  };
}

