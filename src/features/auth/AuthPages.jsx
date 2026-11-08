// W1 Sign in and W2 Register (public) + admin "Register company" page.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Award, ArrowRight, Timer, Mail, Lock, UserRound, User, Wrench, ShieldCheck, Settings, Building2 } from 'lucide-react';
import { COMPANY } from '@shared/membership.js';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE, IS_DEV } from '@/shared/config/env.js';
import { Page, Button, Field, Alert, useToast, cx, useFieldErrors } from '@/shared/ui/index.jsx';
import { PasswordInput } from '@/shared/ui/inputs.jsx';
import { emailError } from '@shared/validation.js';
import { CompanyRegistrationWizard } from './CompanyRegistrationWizard.jsx';

const DEMO = [
  { role: 'Customer', email: 'mahima@mahimaenterprises.com.au', icon: User },
  { role: 'Technician', email: 'dave@sacleaning.com.au', icon: Wrench },
  { role: 'Admin', email: 'admin@sacleaning.com.au', icon: ShieldCheck },
  { role: 'Config', email: 'config@sacleaning.com.au', icon: Settings }
];

const FEATURES = [
  { icon: Timer, title: 'Raise a request', text: 'in under a minute, with photos', tone: 'text-cyan-300' },
  { icon: MapPin, title: 'Track your technician', text: 'live on the map', tone: 'text-cyan-300' },
  { icon: Award, title: 'Earn points for', text: 'free periodic cleaning', tone: 'text-amber-300' }
];

// Sign-in screen: full-bleed blue hero with the technician photo (public/login-hero.png) and a white card
export function LoginPage() {
  const { login, dbStatus } = useAppData();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { errors, check, clear } = useFieldErrors();
  const online = dbStatus === 'ONLINE';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!check({ email: v => emailError(v.email), password: v => (v.password ? '' : 'Password is required.') }, { email, password })) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (res.ok && data.user) { await login(data.user, data.accessToken, data.refreshToken); navigate('/', { replace: true }); }
      else setError(data.error || 'Wrong email or password.');
    } catch {
      setError('Cannot reach the server. Check that the API is running and try again.');
    }
    setLoading(false);
  };

  const fieldCls = 'h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-4 focus:ring-sky-100';

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0a3d91] text-white">
      {/* Background: the client's photo (building, technician and van, waves baked in) over a blue fallback */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b2f73] via-[#0a4fb5] to-[#1d8cf0]" />
      <div className="absolute inset-0 bg-cover bg-[position:62%_center] bg-no-repeat" style={{ backgroundImage: 'url(/login-bg.jpg?v=1)' }} />
      {/* Small screens: darken the photo so the white text stays readable */}
      <div className="absolute inset-0 bg-[#0a3d91]/55 lg:hidden" />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 md:px-12 xl:px-16">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-14 items-center justify-center rounded-2xl bg-white shadow-lg md:h-14 md:w-16"><img src="/logo.webp" alt="SA Commercial Cleaning" className="h-8 w-auto md:h-10" /></span>
            <div>
              <div className="text-lg font-extrabold leading-tight md:text-2xl">SA Commercial Cleaning</div>
              <div className="text-xs text-sky-100 md:text-sm">Emergency cleaning membership · South Australia</div>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur md:px-4 md:py-2 md:text-sm" title="Connection to the SACC server">
            <span className={cx('h-2.5 w-2.5 rounded-full', online ? 'bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,.7)]' : 'bg-red-400')} />
            Server: {online ? 'Online' : dbStatus === 'OFFLINE' ? 'Offline' : 'Checking…'}
          </span>
        </header>

        <div className="grid w-full flex-1 items-center gap-8 px-4 py-8 md:px-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 xl:px-16">
          <section className="max-w-2xl justify-self-start">
            <h1 className="text-3xl font-extrabold italic leading-[1.08] tracking-tight drop-shadow md:text-5xl xl:text-6xl">
              24/7 Commercial Emergency Response,<br /><span className="text-cyan-300">On Site in 2–4 Hours.</span>
            </h1>
            <div className="mt-6 h-0.5 w-24 rounded bg-cyan-300/80" />
            <p className="mt-6 max-w-xl text-sm text-sky-50 md:text-lg">A fast, reliable cleaning response for Australian businesses. Raise a request, track your technician, and keep your site clean and safe.</p>
            <ul className="mt-8 hidden gap-4 sm:grid sm:grid-cols-3 sm:max-w-xl">
              {FEATURES.map(f => (
                <li key={f.title} className="flex flex-col items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-3 py-5 text-center text-sm backdrop-blur-sm">
                  <f.icon className={cx('h-8 w-8', f.tone)} strokeWidth={1.8} />
                  <span><b className="block">{f.title}</b><span className="text-sky-50">{f.text}</span></span>
                </li>
              ))}
            </ul>
          </section>

          <main className="w-full max-w-lg justify-self-center rounded-3xl bg-white p-6 text-slate-900 shadow-2xl shadow-blue-950/40 md:p-9 lg:justify-self-end">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-brand md:h-16 md:w-16"><UserRound className="h-7 w-7 md:h-8 md:w-8" /></span>
              <div>
                <h2 className="text-2xl font-extrabold md:text-3xl">Sign in</h2>
                <p className="text-sm text-slate-500">Customers, technicians and staff all sign in here.</p>
              </div>
            </div>
            <form onSubmit={submit} noValidate className="mt-6 space-y-4">
              <Alert>{error}</Alert>
              <Field label="Email" error={errors.email}>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input type="email" autoComplete="username" placeholder="Enter your email" className={fieldCls} value={email} onChange={e => { setEmail(e.target.value); clear('email'); }} />
                </span>
              </Field>
              <Field label="Password" as="div" error={errors.password}>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-6 z-10 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <PasswordInput autoComplete="current-password" placeholder="Enter your password" className="!h-12 !rounded-xl !pl-11 text-[15px]" value={password} onChange={v => { setPassword(v); clear('password'); }} />
                </div>
              </Field>
              <button type="submit" disabled={loading} title="Sign in with your email and password"
                className="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#1677e5] to-[#0b4fb3] py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 disabled:opacity-60">
                {!loading && <ArrowRight className="h-5 w-5" />}{loading ? 'Signing in…' : 'Sign in'}
              </button>
              {IS_DEV && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-3">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Development demo logins</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {DEMO.map(d => (
                      <button key={d.role} type="button" title={`Fill in the demo login for ${d.role}`} onClick={() => { setEmail(d.email); setPassword('Password123!'); setError(''); }}
                        className={cx('flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition', email === d.email ? 'border-brand bg-brand text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                        <d.icon className="h-4 w-4" />{d.role}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-600"><span className="h-px flex-1 bg-slate-200" />New business in Adelaide?<span className="h-px flex-1 bg-slate-200" /></div>
            <Link to="/register" title="Create a membership for your business"
              className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand text-base font-bold text-brand transition hover:bg-sky-50">
              <Building2 className="h-5 w-5" />Register your business
            </Link>
            <p className="mt-4 text-center text-xs text-slate-500">24/7 hotline <a className="font-bold text-brand" href={`tel:${COMPANY.hotlineTel}`}>{COMPANY.hotline}</a></p>
          </main>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { config, configLoaded, login } = useAppData();
  const navigate = useNavigate();
  const { notify } = useToast();

  const onSuccess = async (customer, payload) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: payload.email, password: payload.password }) });
      const data = await res.json();
      if (res.ok && data.user) { await login(data.user, data.accessToken, data.refreshToken); notify(`Welcome, ${customer.businessName}! Your membership is active.`); navigate('/app', { replace: true }); return; }
    } catch { /* fall through to sign in */ }
    notify('Registration complete. Please sign in.');
    navigate('/login');
  };

  return (
    <div className="min-h-dvh bg-surface">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
        <Link to="/login" className="flex items-center gap-2.5">
          <span className="rounded-lg bg-[#e4e4e4] px-1.5 py-1"><img src="/logo.webp" alt="" className="h-7 w-auto" /></span>
          <span className="text-sm font-extrabold text-slate-900 md:text-base">SA Commercial Cleaning</span>
        </Link>
        <Button title="Go to the sign-in page" to="/login" variant="ghost" size="sm">Already a member? Sign in</Button>
      </header>
      <Page title="Register your business" subtitle="Four short steps. Coverage is Adelaide, South Australia only." width="screen" className="xl:px-8">
        {configLoaded ? <CompanyRegistrationWizard config={config} onClose={() => navigate('/login')} onRegisterSuccess={onSuccess} />
          : <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500" role="status">Loading plans from the server…</p>}
      </Page>
    </div>
  );
}

export function AdminRegisterCompanyPage() {
  const { config, upsertCustomer } = useAppData();
  const navigate = useNavigate();
  const { notify } = useToast();
  return (
    <Page title="Register company" subtitle="Create a customer account and its login" width="medium"
      breadcrumb={[{ label: 'Customers', to: '/admin/customers' }, { label: 'Register company' }]}>
      <CompanyRegistrationWizard isAdminMode config={config} onClose={() => navigate('/admin/customers')}
        onRegisterSuccess={(customer, payload) => {
          upsertCustomer(customer);
          notify(`${customer.businessName} registered. Login: ${payload.email} · password: ${payload.password}`, 'success', { sticky: true });
          navigate(`/admin/customers/${customer.id}`);
        }} />
    </Page>
  );
}
