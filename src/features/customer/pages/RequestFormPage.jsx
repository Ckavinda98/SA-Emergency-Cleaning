// W6 New / edit emergency request as a full page (was NewEmergencyRequestModal + EditEmergencyRequestModal).
// The 12 questions are grouped into 4 sections; a sticky summary column holds the submit button on desktop.
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Building, User, Camera, UploadCloud, X, Siren, Info, Save } from 'lucide-react';
import { useAppData, useCustomerSummary } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { Page, Card, Button, Field, Alert, StickyActions, EmptyState, inputCls, useToast, cx } from '@/shared/ui/index.jsx';
import { jobPhotos, jobVideos, isNewJob } from '@/shared/ui/jobs.jsx';

export function RequestFormPage() {
  const { jobId } = useParams();
  const { jobs, upsertJob, upsertCustomer } = useAppData();
  const s = useCustomerSummary();
  const { account, config } = s;
  const editing = jobId ? jobs.find(j => j.id === jobId) : null;
  if (jobId && !editing) {
    return <Page breadcrumb={[{ label: 'Requests', to: '/app/requests' }, { label: 'Edit' }]}><Card><EmptyState title="Request not found" /></Card></Page>;
  }
  if (editing && !isNewJob(editing.status)) {
    return <Page breadcrumb={[{ label: 'Requests', to: '/app/requests' }, { label: editing.jobNumber, to: `/app/requests/${editing.id}` }, { label: 'Edit' }]}>
      <Card><EmptyState title="This request can no longer be edited" action={<Button to={`/app/requests/${editing.id}`} variant="secondary">Back to the request</Button>}>A technician has already been dispatched. Call the response desk if something has changed.</EmptyState></Card>
    </Page>;
  }
  return <RequestForm key={jobId || 'new'} job={editing} account={account} config={config} summary={s} upsertJob={upsertJob} upsertCustomer={upsertCustomer} />;
}

function RequestForm({ job, account, config, summary, upsertJob, upsertCustomer }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const locations = account.locations || [];
  const firstLoc = locations.find(l => l.id === job?.locationId) || locations[0] || {};

  const [locId, setLocId] = useState(job?.locationId || firstLoc.id || '');
  const [category, setCategory] = useState(job?.category || 'Toilet overflow');
  const [description, setDescription] = useState(job?.description || '');
  const [affectedArea, setAffectedArea] = useState(job?.affectedArea ? String(job.affectedArea) : '');
  const [incidentTime, setIncidentTime] = useState(() => {
    const d = job?.incidentTime ? new Date(job.incidentTime) : new Date();
    return isNaN(d) ? new Date().toISOString().slice(0, 16) : d.toISOString().slice(0, 16);
  });
  const [isOngoing, setIsOngoing] = useState(job?.isOngoing ?? false);
  const [isSafe, setIsSafe] = useState(job?.isSafeToAccess ?? true);
  const [onsiteContact, setOnsiteContact] = useState(job?.onsiteContact ?? (account.primaryContactName || account.primaryContact || ''));
  const [onsitePhone, setOnsitePhone] = useState(job?.onsitePhone ?? (account.phoneNumber || account.phone || ''));
  const [accessInstructions, setAccessInstructions] = useState(job?.accessInstructions ?? (firstLoc.accessInstructions || ''));
  const [accessRestrictions, setAccessRestrictions] = useState(job?.accessRestrictions ?? (firstLoc.securityNotes || ''));
  const [parkingInstructions, setParkingInstructions] = useState(job?.parkingInstructions ?? (firstLoc.parkingNotes || ''));
  const [photos, setPhotos] = useState(job ? jobPhotos(job) : []);
  const [videos, setVideos] = useState(job ? jobVideos(job) : []);
  const [linkInput, setLinkInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [limitHit, setLimitHit] = useState(false);

  const loc = locations.find(l => l.id === locId) || firstLoc;

  const onLocation = (id) => {
    setLocId(id);
    const l = locations.find(x => x.id === id);
    if (l?.accessInstructions) setAccessInstructions(l.accessInstructions);
    setAccessRestrictions(l?.securityNotes || '');
    setParkingInstructions(l?.parkingNotes || '');
  };

  const readFiles = (files, setter) => Array.from(files || []).forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => setter(prev => [...prev, ev.target.result]);
    reader.readAsDataURL(file);
  });

  const addLink = () => {
    const v = linkInput.trim();
    if (!v) return;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(v)) setVideos(p => [...p, v]); else setPhotos(p => [...p, v]);
    setLinkInput('');
  };

  const validate = () => {
    if (!description || description.trim().length < 5) return 'Please describe what happened (at least 5 characters).';
    if (isNaN(Number(affectedArea)) || Number(affectedArea) <= 0) return 'Please enter the affected area in m² (a number above 0).';
    if (!onsiteContact || onsiteContact.trim().length < 2) return 'Please enter the name of the person on site.';
    if (!/^\d{8,12}$/.test(onsitePhone.replace(/[\s\-()+]/g, ''))) return 'Please enter a valid phone number for the person on site (8 to 12 digits).';
    if (!accessInstructions.trim()) return 'Please tell the technician how to get in (access instructions).';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    setError(v);
    if (v) { window.scrollTo?.(0, 0); document.getElementById('main')?.scrollTo(0, 0); return; }
    setSaving(true);
    const body = {
      locationId: loc.id, locationName: loc.name, address: loc.address,
      category, description, affectedArea: parseFloat(affectedArea) || 0, incidentTime, isOngoing, isSafeToAccess: isSafe,
      onsiteContact, onsitePhone, accessInstructions, accessRestrictions, parkingInstructions,
      photos: linkInput.trim() ? [...photos, linkInput.trim()] : photos, videos
    };
    try {
      const res = await fetch(job ? `${API_BASE}/jobs/${job.id}` : `${API_BASE}/jobs`, {
        method: job ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job ? body : { ...body, organizationId: account.id, customerName: account.businessName })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const msg = data.error || 'The request could not be saved.';
        setError(msg);
        if (msg.includes('Call-out Limit')) setLimitHit(true);
        setSaving(false);
        return;
      }
      upsertJob(data);
      if (!job) upsertCustomer({ ...account, calloutsUsed: (account.calloutsUsed || 0) + 1 });
      notify(job ? 'Your changes were saved.' : `Request ${data.jobNumber || ''} sent. We aim to be on site within 2–4 hours.`);
      navigate(`/app/requests/${data.id}`, { replace: true });
    } catch {
      setError(job ? 'Cannot reach the server. Your changes were not saved.' : 'Cannot reach the server. The request was not sent. Please try again or call the hotline.');
      setSaving(false);
    }
  };

  const radio = (name, value, current, set, label) => (
    <label className={cx('flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium', current === value ? 'border-brand bg-sky-50 text-brand-dark' : 'border-slate-300 text-slate-700')}>
      <input type="radio" name={name} checked={current === value} onChange={() => set(value)} className="accent-[#0286cd]" />{label}
    </label>
  );

  const crumbs = job
    ? [{ label: 'Requests', to: '/app/requests' }, { label: job.jobNumber, to: `/app/requests/${job.id}` }, { label: 'Edit' }]
    : [{ label: 'Dashboard', to: '/app' }, { label: 'New emergency request' }];

  return (
    <Page title={job ? `Edit request ${job.jobNumber || ''}` : 'Request emergency cleaning'} subtitle="Fill in what happened and how to get in. Fields marked * are required." breadcrumb={crumbs}>
      <form onSubmit={submit} noValidate className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Alert tone="danger">{error}{limitHit && <> <Button to="/app/membership/change" variant="secondary" size="sm" className="ml-2">Upgrade plan</Button></>}</Alert>
          <Alert tone="warning"><strong>Someone must be on site</strong> when the technician arrives, unless management has approved other access arrangements.</Alert>

          <Card title="1. Location and incident" icon={Building}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Service location" required>
                <select className={inputCls} value={locId} onChange={e => onLocation(e.target.value)}>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.address})</option>)}
                </select>
              </Field>
              <Field label="Type of incident" required>
                <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
                  {(config.incidentCategories || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              {category === 'Toilet overflow' && <Alert tone="info" className="md:col-span-2">{config.toiletOverflowDisclaimer}</Alert>}
              <Field label="What happened?" required className="md:col-span-2">
                <textarea rows={3} className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the incident, the cause and what is affected…" />
              </Field>
              <Field label="Affected area (m²)" required>
                <input type="number" min="1" inputMode="decimal" className={inputCls} value={affectedArea} onChange={e => setAffectedArea(e.target.value)} />
              </Field>
              <Field label="When did it happen?" required>
                <input type="datetime-local" className={inputCls} value={incidentTime} onChange={e => setIncidentTime(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="2. Safety" icon={AlertTriangle}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Is it still happening?">
                <div className="flex gap-2">{radio('ongoing', true, isOngoing, setIsOngoing, 'Yes, still active')}{radio('ongoing', false, isOngoing, setIsOngoing, 'No, contained')}</div>
              </Field>
              <Field label="Is the area safe to enter?">
                <div className="flex gap-2">{radio('safe', true, isSafe, setIsSafe, 'Yes, safe')}{radio('safe', false, isSafe, setIsSafe, 'No, hazards')}</div>
              </Field>
            </div>
          </Card>

          <Card title="3. On-site contact and access" icon={User}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="On-site contact name" required><input className={inputCls} value={onsiteContact} onChange={e => setOnsiteContact(e.target.value)} autoComplete="name" /></Field>
              <Field label="On-site contact phone" required><input type="tel" className={inputCls} value={onsitePhone} onChange={e => setOnsitePhone(e.target.value)} autoComplete="tel" placeholder="0412 345 678" /></Field>
              <Field label="Access instructions" required className="md:col-span-2"><input className={inputCls} value={accessInstructions} onChange={e => setAccessInstructions(e.target.value)} placeholder="Keypad code, lockbox, gate entry…" /></Field>
              <Field label="Access restrictions"><input className={inputCls} value={accessRestrictions} onChange={e => setAccessRestrictions(e.target.value)} placeholder="PPE, height limits, security clearance…" /></Field>
              <Field label="Parking or security"><input className={inputCls} value={parkingInstructions} onChange={e => setParkingInstructions(e.target.value)} placeholder="Loading bay, visitor parking, security desk…" /></Field>
            </div>
          </Card>

          <Card title="4. Photos and videos" icon={Camera}>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">
                <Camera className="h-4 w-4" /> Take or add photos
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => readFiles(e.target.files, setPhotos)} />
              </label>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <UploadCloud className="h-4 w-4" /> Add videos
                <input type="file" accept="video/*" multiple className="hidden" onChange={e => readFiles(e.target.files, setVideos)} />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <input className={inputCls} value={linkInput} onChange={e => setLinkInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} placeholder="…or paste a photo or video link" />
              <Button variant="secondary" onClick={addLink}>Add</Button>
            </div>
            {(photos.length > 0 || videos.length > 0) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.map((src, i) => (
                  <div key={`p${i}`} className="relative">
                    <img src={src} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
                    <button type="button" onClick={() => setPhotos(photos.filter((_, x) => x !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-1 text-white shadow cursor-pointer" aria-label="Remove photo"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {videos.map((src, i) => (
                  <div key={`v${i}`} className="relative flex h-20 w-32 items-center justify-center rounded-xl bg-slate-900 px-2 text-center text-[10px] text-slate-200">
                    Video {i + 1}
                    <button type="button" onClick={() => setVideos(videos.filter((_, x) => x !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-1 text-white shadow cursor-pointer" aria-label="Remove video"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-xs text-slate-500">Photos help the technician bring the right equipment.</p>}
          </Card>

          <StickyActions className="xl:hidden">
            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" variant={job ? 'primary' : 'emergency'} icon={job ? Save : Siren} disabled={saving}>{saving ? 'Sending…' : job ? 'Save changes' : 'Send request'}</Button>
          </StickyActions>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-4 space-y-4">
            <Card title="Summary">
              <dl className="space-y-2 text-sm">
                <div><dt className="text-xs text-slate-500">Site</dt><dd className="font-semibold text-slate-900">{loc.name || '—'}</dd><dd className="text-xs text-slate-500">{loc.address}</dd></div>
                <div><dt className="text-xs text-slate-500">Incident</dt><dd className="font-semibold text-slate-900">{category}</dd></div>
                <div><dt className="text-xs text-slate-500">Media</dt><dd className="font-semibold text-slate-900">{photos.length} photo(s), {videos.length} video(s)</dd></div>
              </dl>
            </Card>
            {!job && (
              <Card tone={summary.exhausted ? 'warning' : 'success'}>
                <div className="flex items-start gap-2 text-sm">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  {summary.exhausted
                    ? <span>All {summary.included} included call-outs are used. This request costs ${config.additionalCalloutFee} plus ${config.overageHourlyRate}/hr. <Link to="/app/membership/change" className="font-semibold underline">Upgrade plan</Link></span>
                    : <span><strong>{summary.remaining} of {summary.included}</strong> included call-outs left this month. This request uses one.</span>}
                </div>
              </Card>
            )}
            <Button type="submit" variant={job ? 'primary' : 'emergency'} size="lg" block icon={job ? Save : Siren} disabled={saving}>{saving ? 'Sending…' : job ? 'Save changes' : 'Send emergency request'}</Button>
            <Button variant="ghost" block onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </aside>
      </form>
    </Page>
  );
}
