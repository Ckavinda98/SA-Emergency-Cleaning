// W4 My requests: full list with search and filters (was the Ongoing / Past tabs in a dashboard card)
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useCustomerSummary } from '@/app/AppData.jsx';
import { Page, Card, Button, Tabs, inputCls } from '@/shared/ui/index.jsx';
import { isFinished } from '@/shared/ui/jobs.jsx';
import { JobList } from '../components/JobList.jsx';

export function RequestsPage() {
  const s = useCustomerSummary();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'ongoing';
  const [q, setQ] = useState('');
  const [site, setSite] = useState('');
  const [type, setType] = useState('');

  const filtered = useMemo(() => s.customerJobs.filter(j => {
    if (status === 'ongoing' && isFinished(j.status)) return false;
    if (status === 'past' && !isFinished(j.status)) return false;
    if (site && j.locationId !== site) return false;
    if (type && j.category !== type) return false;
    if (q) {
      const hay = `${j.jobNumber} ${j.category} ${j.locationName} ${j.address} ${j.description} ${j.technicianName}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [s.customerJobs, status, site, type, q]);

  const counts = {
    ongoing: s.customerJobs.filter(j => !isFinished(j.status)).length,
    past: s.customerJobs.filter(j => isFinished(j.status)).length,
    all: s.customerJobs.length
  };

  return (
    <Page
      fit
      title="My requests"
      subtitle="Track live call-outs and look back at completed work"
      breadcrumb={[{ label: 'Dashboard', to: '/app' }, { label: 'Requests' }]} backTo={false}
      actions={<Button title="Request emergency cleaning" to="/app/requests/new" icon={Plus}>New request</Button>}
    >
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={status} onChange={v => setParams({ status: v })} tabs={[
          { key: 'ongoing', label: 'Ongoing', count: counts.ongoing },
          { key: 'past', label: 'Past', count: counts.past },
          { key: 'all', label: 'All', count: counts.all }
        ]} />
        <div className="grid flex-1 gap-2 sm:grid-cols-3">
          <label className="relative sm:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={`${inputCls} pl-9`} placeholder="Search job number, site…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search requests" />
          </label>
          <select className={inputCls} value={site} onChange={e => setSite(e.target.value)} aria-label="Filter by site">
            <option value="">All sites</option>
            {(s.account?.locations || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className={inputCls} value={type} onChange={e => setType(e.target.value)} aria-label="Filter by incident type">
            <option value="">All incident types</option>
            {(s.config.incidentCategories || []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <Card className="fit:min-h-0 fit:flex-1" bodyClassName="fit:flex-1 fit:overflow-y-auto">
        <JobList jobs={filtered} linkTo={j => `/app/requests/${j.id}`} emptyTitle="No requests match" emptyText="Try another tab or clear the filters." />
      </Card>
    </Page>
  );
}
