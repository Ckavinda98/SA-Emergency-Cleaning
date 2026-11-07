// App shell: header + white sidebar + page area + mobile tab bar.
//  Desktop (≥1280): sidebar open by default and pushes the page; the ≡ button hides it (remembered).
//  Tablet (768–1279): 72 px icon rail; ≡ opens the full sidebar over the page.
//  Mobile (<768): no sidebar; ≡ opens it as a drawer; tab bar at the bottom.
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { Menu, LogOut, ChevronDown, User, Building2, X, Siren } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { useBreakpoint, cx } from '@/shared/ui/index.jsx';
import { NAV, ADMIN_VIEWS, MOBILE_TABS } from './nav.js';
import { tabForPath } from '@shared/roles.js';

const SIDEBAR_KEY = 'sacc_sidebar_hidden';

export function AppShell() {
  const bp = useBreakpoint();
  const { currentUser, logout, loaded } = useAppData();
  const location = useLocation();
  const mainRef = useRef(null);
  const [desktopHidden, setDesktopHidden] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => { setOverlayOpen(false); mainRef.current?.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => { if (bp === 'desktop') setOverlayOpen(false); }, [bp]);

  const toggle = () => {
    if (bp === 'desktop') {
      const next = !desktopHidden;
      setDesktopHidden(next);
      try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    } else {
      setOverlayOpen(o => !o);
    }
  };

  // Admins see the menu of the workspace they are in (admin, customer view or technician view)
  const ws = tabForPath(location.pathname);
  const role = currentUser.role === 'admin' && (ws === 'customer' || ws === 'technician') ? ws : currentUser.role;
  const sidebarExpanded = bp === 'desktop' ? !desktopHidden : overlayOpen;

  return (
    <div className="flex h-dvh flex-col bg-surface text-slate-800">
      <Header onToggle={toggle} expanded={sidebarExpanded} />
      <div className="relative flex min-h-0 flex-1">
        {bp === 'desktop' && !desktopHidden && (
          <aside className="flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white" aria-label="Main navigation">
            <SidebarContent role={role} onLogout={logout} />
          </aside>
        )}
        {bp === 'tablet' && (
          <aside className="w-[72px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white" aria-label="Main navigation">
            <Rail role={role} />
          </aside>
        )}
        <main ref={mainRef} className={cx('min-w-0 flex-1 overflow-y-auto', bp === 'mobile' && 'pb-20')} id="main">
          {loaded ? <Outlet /> : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-slate-500" role="status">
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />Loading…
            </div>
          )}
        </main>
        {overlayOpen && bp !== 'desktop' && (
          <div className="fixed inset-0 z-[90] flex">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOverlayOpen(false)} />
            <aside className="relative z-10 flex h-full w-[280px] max-w-[85vw] flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-xl safe-top">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="text-sm font-bold text-slate-900">Menu</span>
                <button onClick={() => setOverlayOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              <SidebarContent role={role} onLogout={logout} />
            </aside>
          </div>
        )}
      </div>
      {bp === 'mobile' && <BottomTabs role={role} onMore={() => setOverlayOpen(true)} />}
    </div>
  );
}

function Header({ onToggle, expanded }) {
  const { currentUser, customers, selectedCustomerId, setSelectedCustomerId, logout } = useAppData();
  const location = useLocation();
  const showAccountPicker = currentUser.role === 'admin' && location.pathname.startsWith('/app');
  return (
    <header className="safe-top z-50 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 md:px-4">
      <button
        onClick={onToggle}
        aria-label={expanded ? 'Hide menu' : 'Show menu'}
        aria-expanded={expanded}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link to="/" className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-10 items-center rounded-lg bg-[#e4e4e4] px-1.5"><img src="/logo.webp" alt="" className="h-7 w-auto" /></span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-extrabold text-slate-900 md:text-base">SA Emergency Cleaning</span>
          <span className="hidden truncate text-[11px] font-semibold text-brand sm:block">24/7 Response Desk</span>
        </span>
      </Link>
      <div className="flex-1" />
      {showAccountPicker && (
        <label className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 lg:flex">
          <Building2 className="h-4 w-4 text-brand" />
          <span className="text-[11px] font-semibold text-slate-500">Viewing</span>
          <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="max-w-[220px] bg-transparent text-xs font-bold text-brand-dark focus:outline-none cursor-pointer">
            {customers.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select>
        </label>
      )}
      <AvatarMenu user={currentUser} onLogout={logout} />
    </header>
  );
}

function AvatarMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const profilePath = user.role === 'customer' ? '/app/account/profile' : user.role === 'technician' ? '/tech/profile' : null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 hover:bg-slate-50 cursor-pointer" aria-haspopup="menu" aria-expanded={open}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{(user.name || 'U').charAt(0)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-[140px] truncate text-xs font-bold text-slate-900">{user.name}</span>
          <span className="block text-[10px] font-bold uppercase text-brand">{user.role}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2 md:hidden">
            <div className="truncate font-bold text-slate-900">{user.name}</div>
            <div className="text-[11px] font-bold uppercase text-brand">{user.role}</div>
          </div>
          {profilePath && (
            <button role="menuitem" onClick={() => { setOpen(false); navigate(profilePath); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              <User className="h-4 w-4 text-brand" /> Profile
            </button>
          )}
          <button role="menuitem" onClick={() => { setOpen(false); onLogout(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-medium text-red-600 hover:bg-red-50 cursor-pointer">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

// The most specific item that matches the current path is the active one
// (so "New request" is highlighted on /app/requests/new, not "Requests" as well)
function activeTo(items, pathname) {
  let best = null;
  for (const it of items) {
    if (!it.to) continue;
    const hit = it.end ? pathname === it.to : (pathname === it.to || pathname.startsWith(it.to + '/'));
    if (hit && (!best || it.to.length > best.length)) best = it.to;
  }
  return best;
}

const itemCls = (active) => cx(
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
  active ? 'bg-sky-50 text-brand-dark ring-1 ring-sky-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
);

function SidebarContent({ role, onLogout }) {
  const { currentUser, activeCustomer } = useAppData();
  const isAdmin = currentUser.role === 'admin';
  const { pathname } = useLocation();
  const items = NAV[role] || [];
  const views = isAdmin ? [{ to: '/admin/dispatch', label: 'Admin desk', icon: ADMIN_VIEWS[0].icon }, ...ADMIN_VIEWS].filter(v => !(role === 'admin' && v.to === '/admin/dispatch')) : [];
  const current = activeTo([...items, ...views], pathname);
  return (
    <div className="flex flex-1 flex-col gap-1 p-3">
      <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{(currentUser.name || 'U').charAt(0)}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-900">{currentUser.name}</div>
          <div className="truncate text-[11px] text-slate-500">
            <span className="font-bold uppercase text-brand">{currentUser.role}</span>
            {role === 'customer' && activeCustomer?.businessName ? ` · ${activeCustomer.businessName}` : ''}
          </div>
        </div>
      </div>
      {role === 'customer' && (
        <Link to="/app/requests/new" className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700">
          <Siren className="h-4 w-4" /> Emergency request
        </Link>
      )}
      <nav className="flex flex-col gap-1">
        {items.map(it => (
          <NavLink key={it.to} to={it.to} className={itemCls(current === it.to)} aria-current={current === it.to ? 'page' : undefined}>
            <it.icon className="h-[18px] w-[18px] shrink-0" />{it.label}
          </NavLink>
        ))}
      </nav>
      {isAdmin && (
        <>
          <div className="mt-4 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Workspaces</div>
          {views.map(it => (
            <NavLink key={it.to} to={it.to} className={itemCls(current === it.to)}><it.icon className="h-[18px] w-[18px] shrink-0" />{it.label}</NavLink>
          ))}
        </>
      )}
      <div className="flex-1" />
      <button onClick={onLogout} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer">
        <LogOut className="h-[18px] w-[18px]" /> Log out
      </button>
    </div>
  );
}

function Rail({ role }) {
  const items = NAV[role] || [];
  const { pathname } = useLocation();
  const current = activeTo(items, pathname);
  return (
    <nav className="flex flex-col items-center gap-1 py-3">
      {role === 'customer' && (
        <NavLink to="/app/requests/new" title="Emergency request" className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-700">
          <Siren className="h-5 w-5" />
        </NavLink>
      )}
      {items.map(it => (
        <NavLink key={it.to} to={it.to} title={it.label} aria-label={it.label}
          className={cx('flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
            current === it.to ? 'bg-sky-50 text-brand-dark ring-1 ring-sky-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}>
          <it.icon className="h-5 w-5" />
        </NavLink>
      ))}
    </nav>
  );
}

function BottomTabs({ role, onMore }) {
  const tabs = MOBILE_TABS[role] || [];
  const { pathname } = useLocation();
  const current = activeTo(tabs, pathname);
  if (!tabs.length) return null;
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-slate-200 bg-white" aria-label="Main">
      {tabs.map(t => t.menu ? (
        <button key="more" onClick={onMore} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-slate-500 cursor-pointer">
          <t.icon className="h-5 w-5" />{t.label}
        </button>
      ) : t.primary ? (
        <NavLink key={t.to} to={t.to} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-bold text-red-600">
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-4 ring-white"><t.icon className="h-6 w-6" /></span>
          {t.label}
        </NavLink>
      ) : (
        <NavLink key={t.to} to={t.to} className={cx('flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold', current === t.to ? 'text-brand' : 'text-slate-500')}>
          <t.icon className="h-5 w-5" />{t.label}
        </NavLink>
      ))}
    </nav>
  );
}
