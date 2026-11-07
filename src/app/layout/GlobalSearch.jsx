// Search box in the header. Results come from GET /api/search, which only returns records the
// signed-in user may see (a technician finds their own jobs, a customer their own company, and so on).
// Enter or a click opens the record; the arrow button on each row opens it in a new tab.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ExternalLink, ClipboardList, Building2, MapPin, Wrench, Settings, Loader2 } from 'lucide-react';
import { API_BASE } from '@/shared/config/env.js';
import { StatusChip } from '@/shared/ui/jobs.jsx';
import { cx } from '@/shared/ui/index.jsx';

const GROUPS = {
  job: { label: 'Requests and jobs', icon: ClipboardList },
  customer: { label: 'Customers', icon: Building2 },
  site: { label: 'Sites', icon: MapPin },
  technician: { label: 'Technicians', icon: Wrench },
  setting: { label: 'Settings', icon: Settings }
};

const PLACEHOLDER = {
  customer: 'Search your requests and sites',
  technician: 'Search your jobs',
  admin: 'Search jobs, customers, sites, technicians',
  config: 'Search settings, customers, technicians'
};

function useSearch(query) {
  const [state, setState] = useState({ results: [], loading: false, error: '' });
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setState({ results: [], loading: false, error: '' }); return undefined; }
    const ctrl = new AbortController();
    setState(s => ({ ...s, loading: true, error: '' }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search failed');
        setState({ results: data.results || [], loading: false, error: '' });
      } catch (e) {
        if (e.name !== 'AbortError') setState({ results: [], loading: false, error: 'Search is not available right now.' });
      }
    }, 220);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);
  return state;
}

export function GlobalSearch({ role, mobile = false, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(mobile);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const { results, loading, error } = useSearch(query);

  useEffect(() => { setActive(0); }, [results]);
  useEffect(() => { if (mobile) inputRef.current?.focus(); }, [mobile]);

  // Ctrl+K or "/" jumps to search on desktop
  useEffect(() => {
    if (mobile) return undefined;
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobile]);

  useEffect(() => {
    if (mobile) return undefined;
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [mobile]);

  const go = (r) => { navigate(r.url); setQuery(''); setOpen(false); inputRef.current?.blur(); onClose?.(); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); onClose?.(); }
  };

  const showPanel = open && query.trim().length >= 2;
  const grouped = Object.keys(GROUPS).map(type => ({ type, items: results.map((r, i) => ({ ...r, index: i })).filter(r => r.type === type) })).filter(g => g.items.length);

  const panel = showPanel && (
    <div className={cx('overflow-y-auto bg-white', mobile ? 'flex-1' : 'absolute left-0 right-0 top-full z-[120] mt-2 max-h-[70vh] rounded-2xl border border-slate-200 shadow-xl')} role="listbox" id="global-search-results">
      {loading && results.length === 0 && <div className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Searching…</div>}
      {error && <div className="p-4 text-sm text-red-700">{error}</div>}
      {!loading && !error && results.length === 0 && <div className="p-4 text-sm text-slate-500">No matches for “{query.trim()}”.</div>}
      {grouped.map(g => {
        const G = GROUPS[g.type];
        return (
          <div key={g.type} className="py-1">
            <div className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"><G.icon className="h-3 w-3" />{G.label}</div>
            {g.items.map(r => (
              <div key={`${r.type}-${r.id}`} role="option" aria-selected={active === r.index}
                className={cx('group mx-2 flex items-center gap-2 rounded-xl px-2 py-2', active === r.index ? 'bg-sky-50' : 'hover:bg-slate-50')}
                onMouseEnter={() => setActive(r.index)}>
                <button title="Open this record" type="button" onClick={() => go(r)} className="min-w-0 flex-1 text-left cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{r.title}</span>
                    {r.status && <span className="hidden shrink-0 sm:inline"><StatusChip status={r.status} /></span>}
                  </div>
                  <div className="truncate text-xs text-slate-500">{r.subtitle}{r.meta ? ` · ${r.meta}` : ''}</div>
                </button>
                <a href={r.url} target="_blank" rel="noreferrer" title="Open in a new tab" aria-label={`Open ${r.title} in a new tab`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-brand hover:text-brand">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  const input = (
    <div className={cx('flex items-center gap-2 rounded-xl border bg-slate-50 px-3 focus-within:border-brand focus-within:bg-white', mobile ? 'h-11 border-slate-300' : 'h-10 border-slate-200')}>
      <Search className="h-4 w-4 shrink-0 text-slate-400" />
      <input ref={inputRef} type="text" inputMode="search" enterKeyHint="search" value={query} placeholder={PLACEHOLDER[role] || 'Search'}
        onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
        aria-label="Search" aria-expanded={showPanel} aria-controls="global-search-results" role="combobox" aria-autocomplete="list"
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none" />
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
      {!mobile && !query && <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-400 xl:inline">Ctrl K</kbd>}
      {query && <button title="Clear the search" type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search" className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="h-4 w-4" /></button>}
    </div>
  );

  if (mobile) {
    return (
      <div className="fixed inset-0 z-[150] flex flex-col bg-white safe-top">
        <div className="flex items-center gap-2 border-b border-slate-200 p-3">
          <div className="flex-1">{input}</div>
          <button title="Close search" type="button" onClick={onClose} className="h-11 px-2 text-sm font-semibold text-slate-600 cursor-pointer">Cancel</button>
        </div>
        {panel || <p className="p-4 text-sm text-slate-500">Type at least 2 letters. {PLACEHOLDER[role]}.</p>}
      </div>
    );
  }

  return <div ref={boxRef} className="relative w-full">{input}{panel}</div>;
}
