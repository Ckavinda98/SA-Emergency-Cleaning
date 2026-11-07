// Activity log (config account and admin): every add, edit and delete made by customers, technicians,
// admin and config, newest first. Clicking a row opens the change with who, when and every field before and after.
// Filters live in the address (?role=&kind=&entityType=&entityId=&q=&from=&to=&page=) so other pages can link here.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { History, Search, X, ChevronLeft, ChevronRight, PlusCircle, Edit3, Trash2, User, Clock, FileText, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Kpi, Button, Badge, InfoRow, EmptyState, Alert, inputCls, cx } from '@/shared/ui/index.jsx';
import { KINDS, ENTITIES, ROLE_NAMES } from '@shared/activity.js';

const KIND_STYLE = {
  add: { tone: 'success', icon: PlusCircle },
  edit: { tone: 'brand', icon: Edit3 },
  delete: { tone: 'danger', icon: Trash2 },
  other: { tone: 'slate', icon: FileText }
};
const ROLE_TONE = { CUSTOMER: 'brand', TECHNICIAN: 'warning', ADMIN: 'rewards', CONFIG: 'slate' };

const when = (v) => new Date(v).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const whenLong = (v) => new Date(v).toLocaleString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });

function KindBadge({ kind, children }) {
  const k = KIND_STYLE[kind] || KIND_STYLE.other;
  return <Badge tone={k.tone} className="inline-flex items-center gap-1"><k.icon className="h-3 w-3" />{children || KINDS[kind]}</Badge>;
}

const RoleBadge = ({ role, label }) => <Badge tone={ROLE_TONE[role] || 'slate'}>{label || ROLE_NAMES[role] || 'System'}</Badge>;

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'The activity log could not be loaded.');
  return data;
}

// Where the "Open record" button goes, or null when this person can't open it
export function recordLink(row, isAdmin) {
  if (!row.entityExists) return null;
  if (row.entityType === 'Technician') return `/settings/technicians/${row.entityId}`;
  if (row.entityType === 'EmergencyRequest') return isAdmin ? `/admin/jobs/${row.entityId}` : null;
  if (row.entityType === 'Location') return `/settings/customers/${row.organizationId}?tab=sites`;
  if (row.entityType === 'SystemDynamicConfig') return '/settings/pricing';
  if (row.organizationId) return `/settings/customers/${row.organizationId}`;
  return null;
}

export function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState({ loading: true, error: '', items: [], total: 0, page: 1, pageSize: 25 });
  const [counts, setCounts] = useState({});
  const [q, setQ] = useState(params.get('q') || '');
  const filters = Object.fromEntries(['role', 'kind', 'entityType', 'entityId', 'q', 'from', 'to', 'page'].map(k => [k, params.get(k) || '']));
  const query = params.toString();

  const setFilter = (k, v) => setParams(p => {
    const n = new URLSearchParams(p);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'page') n.delete('page');
    return n;
  });

  // Typing searches after a short pause
  useEffect(() => {
    const t = setTimeout(() => { if (q !== filters.q) setFilter('q', q.trim()); }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    setState(s => ({ ...s, loading: true, error: '' }));
    getJson(`${API_BASE}/activity?${query}`)
      .then(d => live && setState({ loading: false, error: '', ...d }))
      .catch(e => live && setState(s => ({ ...s, loading: false, error: e.message })));
    return () => { live = false; };
  }, [query]);

  // Tile numbers: added / edited / deleted with the other filters applied
  useEffect(() => {
    let live = true;
    const base = new URLSearchParams(query); base.delete('kind'); base.delete('page'); base.set('pageSize', '1');
    Promise.all(['add', 'edit', 'delete'].map(k => { const p = new URLSearchParams(base); p.set('kind', k); return getJson(`${API_BASE}/activity?${p}`).then(d => [k, d.total]).catch(() => [k, '–']); }))
      .then(r => live && setCounts(Object.fromEntries(r)));
    return () => { live = false; };
  }, [query]);

  const { items, total, page, pageSize, loading, error } = state;
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  const focus = filters.entityId && items[0] ? `${items[0].entityTypeLabel}: ${items[0].entityLabel || 'record'}` : '';
  const anyFilter = ['role', 'kind', 'entityType', 'entityId', 'q', 'from', 'to'].some(k => filters[k]);
  const open = (row) => navigate(`/settings/activity/${row.id}`, { state: { back: `${location.pathname}${location.search}` } });
  const kindTile = (k) => ({ to: `?${(() => { const p = new URLSearchParams(query); p.delete('page'); if (filters.kind === k) p.delete('kind'); else p.set('kind', k); return p; })()}` });

  return (
    <Page fit title="Activity log" subtitle="Every add, edit and delete by customers, technicians, admin and config, newest first"
      breadcrumb={[{ label: 'Settings', to: '/settings/pricing' }, { label: 'Activity log' }]} backTo={false}>
      <div className="grid shrink-0 grid-cols-3 gap-3">
        <Kpi label="Added" value={counts.add ?? '…'} icon={PlusCircle} tone="success" {...kindTile('add')} title="Show only records that were added" className={filters.kind === 'add' ? 'ring-2 ring-emerald-300' : ''} />
        <Kpi label="Edited" value={counts.edit ?? '…'} icon={Edit3} tone="brand" {...kindTile('edit')} title="Show only changes to existing records" className={filters.kind === 'edit' ? 'ring-2 ring-sky-300' : ''} />
        <Kpi label="Deleted" value={counts.delete ?? '…'} icon={Trash2} tone="danger" {...kindTile('delete')} title="Show only records that were deleted" className={filters.kind === 'delete' ? 'ring-2 ring-red-300' : ''} />
      </div>

      <Card padded={false} className="mt-4 fit:min-h-0 fit:flex-1 flex flex-col overflow-hidden" bodyClassName="flex-1 min-h-0 flex flex-col" title={`Activity (${total})`} icon={History}
        actions={anyFilter && <Button size="sm" variant="ghost" icon={X} onClick={() => { setQ(''); setParams({}); }} title="Remove every filter and show all activity">Clear filters</Button>}>
        <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 md:px-5">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_repeat(3,minmax(130px,1fr))_minmax(130px,1fr)_minmax(130px,1fr)]">
            <label className="relative md:col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={cx(inputCls, 'pl-9')} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, job number or value" aria-label="Search activity" />
            </label>
            <select className={inputCls} value={filters.role} onChange={e => setFilter('role', e.target.value)} aria-label="Who" title="Filter by who made the change">
              <option value="">Everyone</option>
              {Object.entries(ROLE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}s</option>)}
            </select>
            <select className={inputCls} value={filters.kind} onChange={e => setFilter('kind', e.target.value)} aria-label="What" title="Filter by added, edited or deleted">
              <option value="">Added, edited and deleted</option>
              {['add', 'edit', 'delete'].map(k => <option key={k} value={k}>{KINDS[k]} only</option>)}
            </select>
            <select className={inputCls} value={filters.entityType} onChange={e => { setFilter('entityType', e.target.value); }} aria-label="Record type" title="Filter by the kind of record">
              <option value="">All records</option>
              {Object.entries(ENTITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" className={inputCls} value={filters.from} max={filters.to || undefined} onChange={e => setFilter('from', e.target.value)} aria-label="From date" title="Show activity from this date" />
            <input type="date" className={inputCls} value={filters.to} min={filters.from || undefined} onChange={e => setFilter('to', e.target.value)} aria-label="To date" title="Show activity up to this date" />
          </div>
          {filters.entityId && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              <History className="h-4 w-4" /><span>History of one record{focus ? ` · ${focus}` : ''}</span>
              <button type="button" onClick={() => setParams(p => { const n = new URLSearchParams(p); n.delete('entityId'); n.delete('page'); return n; })}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline cursor-pointer" title="Show activity for every record">
                <X className="h-3 w-3" />Show all records
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {error ? <div className="p-4"><Alert>{error}</Alert></div>
            : loading && items.length === 0 ? <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading activity…</p>
            : items.length === 0 ? <div className="p-4"><EmptyState title="No activity matches">Try a wider date range or clear the filters.</EmptyState></div>
            : (
              <div className={cx(loading && 'opacity-60')}>
                <table className="hidden w-full text-left text-sm lg:table border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20">
                    <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="sticky top-0 z-20 bg-white py-3 pl-4 pr-3 border-b border-slate-200 font-bold text-slate-500">When</th>
                      <th className="sticky top-0 z-20 bg-white py-3 pr-3 border-b border-slate-200 font-bold text-slate-500">Who</th>
                      <th className="sticky top-0 z-20 bg-white py-3 pr-3 border-b border-slate-200 font-bold text-slate-500">What they did</th>
                      <th className="sticky top-0 z-20 bg-white py-3 pr-3 border-b border-slate-200 font-bold text-slate-500">Record</th>
                      <th className="sticky top-0 z-20 bg-white py-3 pr-3 border-b border-slate-200 font-bold text-slate-500">Fields</th>
                      <th className="sticky top-0 z-20 bg-white py-3 pr-4 border-b border-slate-200 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map(r => (
                      <tr key={r.id} onClick={() => open(r)} title="Open to see exactly what changed" className="cursor-pointer hover:bg-slate-50 transition-colors">
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 align-top text-xs font-medium text-slate-700 border-b border-slate-100">{when(r.at)}</td>
                        <td className="py-3 pr-3 align-top border-b border-slate-100">
                          <div className="font-semibold text-slate-900">{r.user.name || r.user.email || 'System'}</div>
                          <div className="mt-0.5"><RoleBadge role={r.user.role} label={r.user.roleLabel} /></div>
                        </td>
                        <td className="py-3 pr-3 align-top border-b border-slate-100"><KindBadge kind={r.kind} /><div className="mt-1 font-medium text-slate-900">{r.actionLabel}</div></td>
                        <td className="py-3 pr-3 align-top border-b border-slate-100">
                          <div className="text-[11px] font-semibold uppercase text-slate-400">{r.entityTypeLabel}</div>
                          <div className={cx('font-medium', r.entityExists ? 'text-slate-900' : 'text-slate-500 line-through decoration-slate-300')}>{r.entityLabel || '—'}</div>
                        </td>
                        <td className="max-w-[260px] py-3 pr-3 align-top text-xs text-slate-500 border-b border-slate-100"><span className="line-clamp-2">{r.summary || '—'}</span></td>
                        <td className="py-3 pr-4 align-top border-b border-slate-100"><ChevronRight className="h-4 w-4 text-slate-300" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="space-y-2 p-3 lg:hidden">
                  {items.map(r => (
                    <li key={r.id}>
                      <button type="button" onClick={() => open(r)} title="Open to see exactly what changed" className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm active:bg-slate-50 cursor-pointer">
                        <div className="flex items-center justify-between gap-2"><KindBadge kind={r.kind} /><span className="text-[11px] text-slate-500">{when(r.at)}</span></div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{r.actionLabel}{r.entityLabel ? `: ${r.entityLabel}` : ''}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600"><User className="h-3 w-3" />{r.user.name || r.user.email || 'System'} <RoleBadge role={r.user.role} label={r.user.roleLabel} /></div>
                        {r.summary && <div className="mt-1 truncate text-xs text-slate-500">{r.summary}</div>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
        {total > pageSize && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 md:px-5 flex items-center justify-between gap-2 text-sm text-slate-600">
            <span>Showing {first}–{last} of {total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => setFilter('page', String(page - 1))} title="Newer activity">Newer</Button>
              <Button size="sm" variant="secondary" disabled={last >= total} onClick={() => setFilter('page', String(page + 1))} title="Older activity">Older<ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}

export function ActivityDetailPage() {
  const { logId } = useParams();
  const { currentUser } = useAppData();
  const { state: navState } = useLocation();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    let live = true;
    setRow(null); setError('');
    getJson(`${API_BASE}/activity/${logId}`).then(d => live && setRow(d)).catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [logId]);

  const back = navState?.back || '/settings/activity';
  const crumbs = [{ label: 'Settings', to: '/settings/pricing' }, { label: 'Activity log', to: back }, { label: row?.actionLabel || 'Change' }];
  if (error) return <Page title="Change" breadcrumb={crumbs} backTo={back} width="medium"><Alert>{error}</Alert></Page>;
  if (!row) return <Page title="Loading…" breadcrumb={crumbs} backTo={back} width="medium"><p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p></Page>;

  const link = recordLink(row, isAdmin);
  const KindIcon = (KIND_STYLE[row.kind] || KIND_STYLE.other).icon;
  return (
    <Page title={row.actionLabel} subtitle={row.entityLabel ? `${row.entityTypeLabel}: ${row.entityLabel}` : row.entityTypeLabel} breadcrumb={crumbs} backTo={back} width="medium"
      actions={<>
        {row.entityId && <Button variant="secondary" icon={History} to={`/settings/activity?entityType=${row.entityType}&entityId=${row.entityId}`} title="See every change made to this record">All changes to this record</Button>}
        {link && <Button icon={ExternalLink} to={link} title="Open the record to see it or edit it">Open record</Button>}
      </>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card title="Who and when" icon={Clock}>
            <dl className="space-y-3">
              <InfoRow label="Done by"><span className="flex flex-wrap items-center gap-2">{row.user.name || 'Unknown person'}<RoleBadge role={row.user.role} label={row.user.roleLabel} /></span></InfoRow>
              <InfoRow label="Login email">{row.user.email}</InfoRow>
              <InfoRow label="Date and time">{whenLong(row.at)}</InfoRow>
              <InfoRow label="Type of change"><KindBadge kind={row.kind}>{KINDS[row.kind]}</KindBadge></InfoRow>
              <InfoRow label="Device address (IP)">{row.ipAddress}</InfoRow>
            </dl>
          </Card>
          <Card title="Record" icon={FileText}>
            <dl className="space-y-3">
              <InfoRow label="Type">{row.entityTypeLabel}</InfoRow>
              <InfoRow label="Name">{row.entityLabel}</InfoRow>
            </dl>
            {!row.entityExists && row.entityId && row.entityType !== 'SystemDynamicConfig' && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-600"><AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />This record has since been deleted. The values below were saved at the time.</p>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          {row.changes.length > 0 && (
            <Card title={`What changed (${row.changes.length})`} icon={Edit3}>
              <ChangeTable rows={row.changes} />
            </Card>
          )}
          {row.values.length > 0 && (
            <Card title={row.kind === 'add' ? 'Details entered' : row.kind === 'delete' ? 'Details at the time it was deleted' : 'Details'} icon={KindIcon}>
              <dl className="divide-y divide-slate-100">
                {row.values.map(v => (
                  <div key={v.field} className="grid gap-1 py-2 sm:grid-cols-[200px_1fr]">
                    <dt className="text-xs font-semibold text-slate-500">{v.label}</dt>
                    <dd className="break-words text-sm text-slate-900">{v.value ?? <span className="text-slate-400">empty</span>}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          {row.changes.length === 0 && row.values.length === 0 && <Card><EmptyState title="No field details were saved for this change" /></Card>}
        </div>
      </div>
    </Page>
  );
}

function ChangeTable({ rows }) {
  const empty = <span className="italic text-slate-400">empty</span>;
  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <thead><tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <th className="w-1/4 py-2 pr-3">Field</th><th className="py-2 pr-3">Before</th><th className="py-2">After</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(c => (
            <tr key={c.field}>
              <td className="py-2.5 pr-3 align-top text-xs font-semibold text-slate-600">{c.label}</td>
              <td className="py-2.5 pr-3 align-top"><span className="break-words rounded bg-red-50 px-1.5 py-0.5 text-red-800">{c.from ?? empty}</span></td>
              <td className="py-2.5 align-top"><span className="break-words rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">{c.to ?? empty}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-2 md:hidden">
        {rows.map(c => (
          <li key={c.field} className="rounded-xl border border-slate-200 p-2.5 text-sm">
            <div className="text-xs font-semibold text-slate-600">{c.label}</div>
            <div className="mt-1 break-words text-red-800"><span className="text-[10px] font-bold uppercase text-slate-400">Before </span>{c.from ?? empty}</div>
            <div className="break-words text-emerald-800"><span className="text-[10px] font-bold uppercase text-slate-400">After </span>{c.to ?? empty}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
