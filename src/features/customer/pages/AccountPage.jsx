// W10 Account: company profile, sites and security as pages (was CompanyProfileModal + ManageSitesSection).
// Desktop has a left sub-menu; tablet and phones show the sections as tabs.
import React, { useState } from 'react';
import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Building2, MapPin, Lock, Plus, Edit3, Trash2, Save } from 'lucide-react';
import { useAppData, useCustomerSummary } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Button, Field, Alert, StickyActions, InlineConfirm, EmptyState, inputCls, useToast, useFieldErrors, cx } from '@/shared/ui/index.jsx';
import { PhoneInput, PasswordInput, AddressAutocomplete } from '@/shared/ui/inputs.jsx';
import { phoneError, emailError, passwordError, confirmPasswordError, personNameError, textError } from '@shared/validation.js';

const SECTIONS = [
  { key: 'profile', label: 'Company profile', icon: Building2 },
  { key: 'sites', label: 'Sites', icon: MapPin },
  { key: 'security', label: 'Security', icon: Lock }
];

export function AccountPage() {
  const { section } = useParams();
  const { account } = useCustomerSummary();
  const current = SECTIONS.find(s => s.key === section);
  if (!current) return <Navigate to="/app/account/profile" replace />;

  return (
    <Page title="Account" subtitle={account.businessName} breadcrumb={[{ label: 'Dashboard', to: '/app' }, { label: 'Account' }, { label: current.label }]} backTo={false}>
      <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 xl:flex-col xl:self-start xl:rounded-2xl xl:border xl:border-slate-200 xl:bg-white xl:p-2" aria-label="Account sections">
          {SECTIONS.map(s => (
            <NavLink key={s.key} to={`/app/account/${s.key}`} className={({ isActive }) => cx(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold',
              isActive ? 'bg-white text-brand-dark shadow-sm xl:bg-sky-50 xl:shadow-none xl:ring-1 xl:ring-sky-200' : 'text-slate-600 hover:text-slate-900 xl:hover:bg-slate-50')}>
              <s.icon className="h-4 w-4" />{s.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          {section === 'profile' && <ProfileSection account={account} />}
          {section === 'sites' && <SitesSection account={account} />}
          {section === 'security' && <SecuritySection account={account} />}
        </div>
      </div>
    </Page>
  );
}

function ProfileSection({ account }) {
  const { upsertCustomer } = useAppData();
  const { notify } = useToast();
  const [form, setForm] = useState({
    businessName: account.businessName || '',
    primaryContactName: account.primaryContactName || account.primaryContact || '',
    phoneNumber: account.phoneNumber || account.phone || '',
    email: account.email || ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, check, clear, fromServer } = useFieldErrors();
  const setVal = (k) => (v) => { setForm(f => ({ ...f, [k]: v })); clear(k); };
  const set = (k) => (e) => setVal(k)(e.target.value);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const ok = check({
      businessName: v => textError(v.businessName, { label: 'Company name' }),
      primaryContactName: v => personNameError(v.primaryContactName, { label: 'Primary contact' }),
      phoneNumber: v => phoneError(v.phoneNumber),
      email: v => emailError(v.email)
    }, form);
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok && data.customer) { upsertCustomer(data.customer); notify('Company profile saved.'); }
      else if (!fromServer(data)) setError(data.error || 'The profile could not be saved.');
    } catch { setError('Cannot reach the server. Nothing was saved.'); }
    setSaving(false);
  };

  return (
    <form onSubmit={save} noValidate>
      <Card title="Company profile" icon={Building2}>
        <Alert>{error}</Alert>
        <div className="mt-1 grid gap-3 md:grid-cols-2">
          <Field label="Company name" required className="md:col-span-2" error={errors.businessName}><input className={inputCls} value={form.businessName} onChange={set('businessName')} autoComplete="organization" /></Field>
          <Field label="ABN" hint="Call us to change your ABN"><input className={cx(inputCls, 'bg-slate-50')} value={account.abn || ''} disabled /></Field>
          <Field label="Primary contact" required error={errors.primaryContactName}><input className={inputCls} value={form.primaryContactName} onChange={set('primaryContactName')} autoComplete="name" /></Field>
          <Field label="Phone number" required error={errors.phoneNumber}><PhoneInput value={form.phoneNumber} onChange={setVal('phoneNumber')} /></Field>
          <Field label="Email address" required error={errors.email}><input type="email" className={inputCls} value={form.email} onChange={set('email')} autoComplete="email" /></Field>
        </div>
      </Card>
      <StickyActions>
        <Button type="submit" icon={Save} disabled={saving} title="Save the company name, contact, phone and email">{saving ? 'Saving…' : 'Save changes'}</Button>
      </StickyActions>
    </form>
  );
}

const EMPTY_SITE = { name: '', address: '', contactName: '', contactPhone: '', accessInstructions: '', securityNotes: '' };

// Also used by staff on the customer page (allowAdd is false for the config account)
export function SitesSection({ account, allowAdd = true }) {
  const { upsertCustomer } = useAppData();
  const { notify } = useToast();
  const sites = account.locations || [];
  const [editing, setEditing] = useState(null); // null | 'new' | site id
  const [form, setForm] = useState(EMPTY_SITE);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { errors, check, clear, fromServer, setErrors } = useFieldErrors();
  const setVal = (k) => (v) => { setForm(f => ({ ...f, [k]: v })); clear(k); };

  const open = (site) => {
    setError(''); setErrors({});
    setEditing(site ? site.id : 'new');
    setForm(site ? Object.fromEntries(Object.keys(EMPTY_SITE).map(k => [k, site[k] || ''])) : EMPTY_SITE);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const ok = check({
      name: v => textError(v.name, { label: 'Site name' }),
      address: v => textError(v.address, { label: 'Street address', min: 4 }),
      contactName: v => personNameError(v.contactName, { label: 'Site contact', required: false }),
      contactPhone: v => phoneError(v.contactPhone, { required: false })
    }, form);
    if (!ok) return;
    setBusy(true);
    const isNew = editing === 'new';
    try {
      const res = await fetch(isNew ? `${API_BASE}/customers/${account.id}/locations` : `${API_BASE}/locations/${editing}`, {
        method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { if (!fromServer(data)) setError(data.error || 'The site could not be saved.'); setBusy(false); return; }
      const next = isNew ? [...sites, data] : sites.map(s => s.id === data.id ? data : s);
      upsertCustomer({ ...account, locations: next });
      notify(isNew ? 'Site added.' : 'Site saved.');
      setEditing(null);
    } catch { setError('Cannot reach the server. The site was not saved.'); }
    setBusy(false);
  };

  const f = (k, label, req, cls) => (
    <Field label={label} required={req} className={cls} error={errors[k]}><input className={inputCls} value={form[k]} onChange={e => setVal(k)(e.target.value)} /></Field>
  );

  return (
    <div className="space-y-4">
      <Card title={`Service sites (${sites.length})`} icon={MapPin} actions={editing === null && allowAdd && <Button size="sm" icon={Plus} onClick={() => open(null)} title="Add another address we clean or service">Add site</Button>}>
        {sites.length === 0 ? <EmptyState title="No sites yet" /> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {sites.map(site => (
              <li key={site.id} className={cx('rounded-xl border p-3', editing === site.id ? 'border-brand bg-sky-50' : 'border-slate-200 bg-slate-50')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{site.name}</div>
                    <div className="text-sm text-slate-600">{site.address}</div>
                    {(site.contactName || site.contactPhone) && <div className="mt-1 text-xs text-slate-500">Contact: {site.contactName} {site.contactPhone && `· ${site.contactPhone}`}</div>}
                    {site.accessInstructions && <div className="mt-1 text-xs text-slate-500">Access: {site.accessInstructions}</div>}
                  </div>
                  <Button size="sm" variant="secondary" icon={Edit3} onClick={() => open(site)} title={`Edit ${site.name}`}>Edit</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing !== null && (
        <form onSubmit={save} noValidate>
          <Card title={editing === 'new' ? 'Add a site' : 'Edit site'}>
            <Alert>{error}</Alert>
            <div className="mt-1 grid gap-3 md:grid-cols-2">
              {f('name', 'Site name', true)}
              <Field label="Street address (Adelaide, SA)" required as="div" error={errors.address}>
                <AddressAutocomplete value={form.address} onChange={setVal('address')}
                  onSelect={a => setVal('address')(a.address || a.street)} />
              </Field>
              {f('contactName', 'Site contact')}
              <Field label="Contact phone" error={errors.contactPhone}><PhoneInput value={form.contactPhone} onChange={setVal('contactPhone')} /></Field>
              {f('accessInstructions', 'Access instructions', false, 'md:col-span-2')}
              {f('securityNotes', 'Security / hazard notes', false, 'md:col-span-2')}
            </div>
          </Card>
          <StickyActions>
            <Button variant="ghost" onClick={() => setEditing(null)} title="Close without saving">Cancel</Button>
            <Button type="submit" icon={Save} disabled={busy} title="Save this site">{busy ? 'Saving…' : 'Save site'}</Button>
          </StickyActions>
        </form>
      )}
    </div>
  );
}

function SecuritySection({ account }) {
  const { logout } = useAppData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, check, clear, fromServer } = useFieldErrors();

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const ok = check({
      password: v => passwordError(v.pw),
      confirm: v => confirmPasswordError(v.pw, v.pw2)
    }, { pw, pw2 });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw })
      });
      const data = await res.json();
      if (res.ok) { notify('Password changed.'); setPw(''); setPw2(''); }
      else if (!fromServer(data)) setError(data.error || 'The password could not be changed.');
    } catch { setError('Cannot reach the server. The password was not changed.'); }
    setSaving(false);
  };

  const deleteAccount = async () => {
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}`, { method: 'DELETE' });
      if (res.ok) { notify('Your account has been deleted.'); await logout(); navigate('/login'); }
      else { const d = await res.json().catch(() => ({})); notify(d.error || 'The account could not be deleted.', 'danger'); }
    } catch { notify('Cannot reach the server. Nothing was deleted.', 'danger'); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={save} noValidate>
        <Card title="Change password" icon={Lock}>
          <Alert>{error}</Alert>
          <div className="mt-1 grid gap-3 md:grid-cols-2">
            <Field label="New password" required as="div" error={errors.password}>
              <PasswordInput value={pw} onChange={v => { setPw(v); clear('password'); }} showChecklist />
            </Field>
            <Field label="Confirm new password" required as="div" error={errors.confirm}>
              <PasswordInput value={pw2} onChange={v => { setPw2(v); clear('confirm'); }} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end"><Button type="submit" disabled={saving} title="Change the password you use to sign in">{saving ? 'Saving…' : 'Change password'}</Button></div>
        </Card>
      </form>
      <Card title="Delete account" icon={Trash2} tone="danger">
        <p className="text-sm text-red-900">Permanently delete this company account and all its data. This cannot be undone.</p>
        <div className="mt-3">
          <InlineConfirm label="Delete account" title="Permanently delete this company account" icon={Trash2} message="Delete everything for good?" confirmLabel="Yes, delete" onConfirm={deleteAccount} />
        </div>
      </Card>
    </div>
  );
}
