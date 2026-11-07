// W1 Sign in and W2 Register (public) + admin "Register company" page.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Siren, Clock, MapPin, Award, ArrowRight } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { API_BASE, IS_DEV } from '@/shared/config/env.js';
import { Page, Button, Field, Alert, inputCls, useToast, cx, useFieldErrors } from '@/shared/ui/index.jsx';
import { PasswordInput } from '@/shared/ui/inputs.jsx';
import { emailError } from '@shared/validation.js';
import { CompanyRegistrationWizard } from './CompanyRegistrationWizard.jsx';

const DEMO = [
  { role: 'Customer', email: 'mahima@mahimaenterprises.com.au' },
  { role: 'Technician', email: 'dave@sacleaning.com.au' },
  { role: 'Admin', email: 'admin@sacleaning.com.au' },
  { role: 'Config', email: 'config@sacleaning.com.au' }
];

function BrandPanel({ compact }) {
  return (
    <div className={cx('relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-dark to-brand text-white', compact ? 'p-5' : 'p-10')}>
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-white/90 p-1.5"><img src="/logo.webp" alt="" className="h-9 w-auto" /></span>
        <div><div className="text-lg font-extrabold leading-tight">SA Commercial Cleaning</div><div className="text-xs text-sky-100">Emergency cleaning membership · South Australia</div></div>
      </div>
      {!compact && (
        <div className="my-10 max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight xl:text-4xl">24/7 commercial emergency response, on site in 2–4 hours.</h2>
          <ul className="mt-6 space-y-3 text-sm text-sky-50">
            <li className="flex gap-3"><Siren className="h-5 w-5 shrink-0 text-amber-300" />Raise a request in under a minute, with photos</li>
            <li className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-amber-300" />Track your technician live on the map</li>
            <li className="flex gap-3"><Award className="h-5 w-5 shrink-0 text-amber-300" />Earn points for free periodic cleaning</li>
          </ul>
        </div>
      )}
      {!compact && <div className="flex items-center gap-2 text-xs text-sky-100"><Clock className="h-4 w-4" />Response desk open 24 hours, 7 days</div>}
    </div>
  );
}

export function LoginPage() {
  const { login, dbStatus } = useAppData();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { errors, check, clear } = useFieldErrors();

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

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:flex"><BrandPanel /></div>
      <div className="lg:hidden"><BrandPanel compact /></div>
      <main className="flex items-start justify-center px-4 py-8 md:items-center md:py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-extrabold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Customers, technicians and staff all sign in here.</p>
          <form onSubmit={submit} noValidate className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Alert>{error}</Alert>
            <Field label="Email" error={errors.email}><input type="email" autoComplete="username" className={inputCls} value={email} onChange={e => { setEmail(e.target.value); clear('email'); }} /></Field>
            <Field label="Password" as="div" error={errors.password}><PasswordInput autoComplete="current-password" value={password} onChange={v => { setPassword(v); clear('password'); }} /></Field>
            <Button type="submit" size="lg" block disabled={loading} icon={loading ? undefined : ArrowRight} title="Sign in with your email and password">{loading ? 'Signing in…' : 'Sign in'}</Button>
            {IS_DEV && (
              <div className="rounded-xl border border-dashed border-slate-300 p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Development demo logins</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DEMO.map(d => (
                    <button key={d.role} type="button" title={`Fill in the demo login for ${d.label || d.role}`} onClick={() => { setEmail(d.email); setPassword('Password123!'); setError(''); }}
                      className={cx('h-8 rounded-lg border text-xs font-semibold cursor-pointer', email === d.email ? 'border-brand bg-brand text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>{d.role}</button>
                  ))}
                </div>
              </div>
            )}
          </form>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-sm text-slate-600">New business in Adelaide?</p>
            <Button title="Create a membership for your business" to="/register" variant="secondary" block className="mt-3">Register your business</Button>
          </div>
          <p className="mt-4 text-center text-[11px] text-slate-400">Server: {dbStatus === 'ONLINE' ? 'online' : dbStatus.toLowerCase()}</p>
        </div>
      </main>
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
      <Page title="Register your business" subtitle="Four short steps. Coverage is Adelaide, South Australia only." width="medium">
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
