// Shared UI building blocks for every page (web now, and the Android/iOS apps through Capacitor).
// Colours and sizes come from the design tokens in src/index.css (see --color-brand etc.).
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Info, X, ChevronRight, Inbox, ArrowLeft } from 'lucide-react';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ----------------------------------------------------------------- Page layout */

// Page: standard page frame with breadcrumb, title and actions.
// fit: on desktop screens (≥1280 wide and ≥700 tall) the page fills the screen exactly and
// only the parts marked with `flex-1 min-h-0` scroll inside themselves. Smaller screens scroll normally.
// A page opened from a list gets a back arrow to that list. By default it points at the
// nearest breadcrumb link above the current page; pass backTo to override, or backTo={false} to hide it.
export function Page({ title, subtitle, breadcrumb, actions, children, fit = false, width = 'full', className, backTo }) {
  const max = width === 'narrow' ? 'max-w-3xl' : width === 'medium' ? 'max-w-5xl' : 'max-w-[1600px]';
  const parent = backTo === false ? null
    : backTo ? { to: backTo, label: 'Back' }
    : [...(breadcrumb || [])].slice(0, -1).reverse().find(b => b.to);
  return (
    <div className={cx('mx-auto w-full px-4 py-4 md:px-6 md:py-5 xl:px-8', max, fit && 'fit:h-full fit:flex fit:flex-col', className)}>
      {(title || breadcrumb || actions) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 shrink-0">
          <div className="min-w-0">
            {breadcrumb && (
              <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500" aria-label="Breadcrumb">
                {breadcrumb.map((b, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="h-3 w-3" />}
                    {b.to ? <Link to={b.to} className="hover:text-brand">{b.label}</Link> : <span className="text-slate-700">{b.label}</span>}
                  </React.Fragment>
                ))}
              </nav>
            )}
            {title && (
              <div className="flex items-start gap-2">
                {parent && (
                  <Link to={parent.to} aria-label={`Back to ${parent.label}`} title={`Back to ${parent.label}`}
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-brand hover:text-brand md:mt-0">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                )}
                <h1 className="min-w-0 text-xl font-extrabold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
              </div>
            )}
            {subtitle && <p className={cx("mt-0.5 text-sm text-slate-500", parent && title && "pl-10")}>{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Card({ title, icon: Icon, actions, children, className, bodyClassName, tone, padded = true, id }) {
  const toneCls = {
    brand: 'bg-gradient-to-br from-brand-dark to-brand text-white border-transparent',
    danger: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-emerald-50 border-emerald-200',
    rewards: 'bg-purple-50 border-purple-200'
  }[tone] || 'bg-white border-slate-200';
  return (
    <section id={id} className={cx('flex min-w-0 flex-col rounded-2xl border shadow-sm', toneCls, className)}>
      {(title || actions) && (
        <header className={cx('flex flex-wrap items-center justify-between gap-2 shrink-0', padded ? 'px-4 pt-4 md:px-5' : 'px-4 py-3 border-b border-slate-100')}>
          {title && (
            <h2 className={cx('flex items-center gap-2 text-sm font-bold', tone === 'brand' ? 'text-white' : 'text-slate-900')}>
              {Icon && <Icon className={cx('h-4 w-4', tone === 'brand' ? 'text-white' : 'text-brand')} />}
              {title}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(padded && 'p-4 md:p-5', title && padded && 'pt-3 md:pt-3', 'min-h-0', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- Buttons */

const BTN_VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  'danger-soft': 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  rewards: 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm',
  white: 'bg-white text-brand-dark hover:bg-slate-100 shadow-sm',
  emergency: 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
};
const BTN_SIZES = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-sm' };

export function Button({ variant = 'primary', size = 'md', to, href, icon: Icon, children, className, block, ...rest }) {
  const cls = cx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
    BTN_VARIANTS[variant], BTN_SIZES[size], block && 'w-full', className
  );
  const inner = <>{Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}{children}</>;
  if (to) return <Link to={to} className={cls} {...rest}>{inner}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{inner}</a>;
  return <button type="button" className={cls} {...rest}>{inner}</button>;
}

/* ----------------------------------------------------------------- Data display */

// A tile with a number. With `to` the whole tile is a link to the matching list.
export function Kpi({ label, value, sub, tone = 'brand', icon: Icon, action, className, to, title }) {
  const accent = { brand: 'text-brand', success: 'text-emerald-600', warning: 'text-amber-600', danger: 'text-red-600', rewards: 'text-purple-600', slate: 'text-slate-900' }[tone];
  const Tag = to ? Link : 'div';
  return (
    <Tag to={to} title={title || (to ? `Open ${String(label).toLowerCase()}` : undefined)}
      className={cx('group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', to && 'cursor-pointer transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {Icon && <Icon className={cx('h-4 w-4 shrink-0', accent)} />}
      </div>
      <div className={cx('mt-1 text-2xl font-extrabold tracking-tight', accent)}>{value}</div>
      {(sub || action || to) && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500">
          <span>{sub}</span>{action || (to && <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-brand" />)}
        </div>
      )}
    </Tag>
  );
}

export function Badge({ tone = 'slate', children, className }) {
  const t = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    brand: 'bg-sky-50 text-brand-dark border-sky-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    rewards: 'bg-purple-50 text-purple-700 border-purple-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap', t, className)}>{children}</span>;
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1', className)} role="tablist">
      {tabs.map(t => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          title={`Show ${String(t.label).toLowerCase()}`}
          onClick={() => onChange(t.key)}
          className={cx('h-8 shrink-0 rounded-lg px-3 text-xs font-bold transition-colors cursor-pointer',
            value === t.key ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-600 hover:text-slate-900')}
        >
          {t.label}{t.count !== undefined && <span className="ml-1 text-slate-400">({t.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <Icon className="h-8 w-8 text-slate-300" />
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {children && <p className="max-w-sm text-xs text-slate-500">{children}</p>}
      {action}
    </div>
  );
}

export function InfoRow({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{children || '—'}</dd>
    </div>
  );
}

/* ----------------------------------------------------------------- Forms */

export const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base md:text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

// A labelled form field. Pass error="…" to show the message under this field and outline the input in red.
export function Field({ label, required, hint, error, children, className, as = 'label' }) {
  const Tag = as;
  // Marks the input red. Works for plain inputs and for PhoneInput / PasswordInput / AddressAutocomplete,
  // which pass aria-invalid and className on to their own <input>.
  const child = error && React.isValidElement(children) && children.type !== React.Fragment
    ? React.cloneElement(children, { 'aria-invalid': true, className: cx(children.props.className, '!border-red-400 !bg-red-50/40 focus:!border-red-500') })
    : children;
  return (
    <Tag className={cx('block min-w-0', className)}>
      {label && <span className="mb-1 block text-xs font-semibold text-slate-700">{label}{required && <span className="text-red-500"> *</span>}</span>}
      {child}
      {hint && !error && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
      {error && <span className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-red-600" role="alert"><AlertCircle className="mt-px h-3 w-3 shrink-0" />{error}</span>}
    </Tag>
  );
}

// Form errors keyed by field name. check() runs the rules, shows every message under its field,
// moves focus to the first problem and returns true only when everything is valid.
export function useFieldErrors() {
  const [errors, setErrors] = useState({});
  const check = (rules, values) => {
    const next = {};
    for (const [field, rule] of Object.entries(rules)) { const m = rule(values); if (m) next[field] = m; }
    setErrors(next);
    if (Object.keys(next).length) setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
    return Object.keys(next).length === 0;
  };
  // Clear a field's message as soon as the user edits it
  const clear = (field) => setErrors(e => (e[field] ? { ...e, [field]: undefined } : e));
  const set = (field, message) => setErrors(e => ({ ...e, [field]: message }));
  // Puts the API's per-field messages (400 { fields }) under the fields. Returns true when it did.
  const fromServer = (data) => {
    const f = data?.fields;
    if (!f || !Object.keys(f).length) return false;
    setErrors(f);
    setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
    return true;
  };
  return { errors, check, clear, set, setErrors, fromServer };
}

export function Alert({ tone = 'danger', children, className }) {
  const t = { danger: 'bg-red-50 border-red-200 text-red-800', warning: 'bg-amber-50 border-amber-200 text-amber-900', info: 'bg-sky-50 border-sky-200 text-sky-900', success: 'bg-emerald-50 border-emerald-200 text-emerald-800' }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;
  if (!children) return null;
  return (
    <div className={cx('flex items-start gap-2 rounded-xl border p-3 text-sm', t, className)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0">{children}</div>
    </div>
  );
}

// Sticky bottom action bar for forms (always visible on phones, sits at the end of the form on desktop)
export function StickyActions({ children, className }) {
  return (
    <div className={cx('sticky bottom-0 z-10 -mx-4 mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:rounded-2xl md:border md:shadow-sm', className)}>
      {children}
    </div>
  );
}

// Inline "Are you sure?" in place of window.confirm()
export function InlineConfirm({ label, confirmLabel = 'Confirm', message, onConfirm, variant = 'danger-soft', size = 'sm', icon, disabled, title, confirmVariant = 'danger', className }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) return <Button variant={variant} size={size} icon={icon} disabled={disabled} title={title} className={className} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAsking(true); }}>{label}</Button>;
  const tone = confirmVariant === 'danger' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-2 rounded-xl border px-2 py-1', tone)} onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
      {message && <span className="text-xs font-semibold">{message}</span>}
      <Button variant={confirmVariant} size="sm" disabled={busy} title={`Yes: ${String(label).toLowerCase()}`} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); setAsking(false); } }}>{busy ? 'Working…' : confirmLabel}</Button>
      <Button variant="ghost" size="sm" title="Go back without doing anything" onClick={() => setAsking(false)}>Cancel</Button>
    </span>
  );
}

/* ----------------------------------------------------------------- Toasts (replace alert()) */

const ToastContext = createContext({ notify: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const notify = useCallback((message, tone = 'success', { sticky = false } = {}) => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, message, tone }]);
    if (!sticky) setTimeout(() => dismiss(id), tone === 'danger' ? 7000 : 4000);
  }, [dismiss]);
  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[68px] z-[200] flex flex-col items-center gap-2 px-4 md:top-auto md:bottom-6 md:items-end md:px-6" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={cx('pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border bg-white p-3 text-sm shadow-lg',
            t.tone === 'danger' ? 'border-red-200' : t.tone === 'warning' ? 'border-amber-200' : 'border-emerald-200')}>
            {t.tone === 'danger' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
            <span className="min-w-0 flex-1 text-slate-800">{t.message}</span>
            <button title="Dismiss this message" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ----------------------------------------------------------------- Hooks */

// 'mobile' (<768), 'tablet' (768–1279) or 'desktop' (≥1280). Matches the breakpoints in the redesign plan.
export function useBreakpoint() {
  const get = () => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    return w >= 1280 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile';
  };
  const [bp, setBp] = useState(get);
  useEffect(() => {
    const onResize = () => setBp(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return bp;
}
