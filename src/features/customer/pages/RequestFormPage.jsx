// W6 New / edit emergency request as a full page (was NewEmergencyRequestModal + EditEmergencyRequestModal).
// The 12 questions are grouped into 4 sections; a sticky summary column holds the submit button on desktop.
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Building, User, Camera, UploadCloud, X, Siren, Info, Save } from 'lucide-react';
import { useAppData, useCustomerSummary } from '@/app/AppData.jsx';
import { API_BASE } from '@/shared/config/env.js';
import { uploadFile } from '@/shared/api/files.js';
import { Page, Card, Button, Field, Alert, StickyActions, EmptyState, inputCls, useToast, cx, useFieldErrors } from '@/shared/ui/index.jsx';
import { PhoneInput } from '@/shared/ui/inputs.jsx';
import { phoneError, personNameError, numberError } from '@shared/validation.js';
import { jobPhotos, jobVideos, isNewJob } from '@/shared/ui/jobs.jsx';
import { HotlineLink, fmtMoney } from '@/shared/ui/membership.jsx';
import { coverageWarnings, WATER_TYPES, HAZARDS, isAfterHours, surchargeFor } from '@shared/membership.js';

export function RequestFormPage() {
  const { jobId } = useParams();
  const { jobs, upsertJob, upsertCustomer } = useAppData();
  const s = useCustomerSummary();
  const { account, config } = s;
  const editing = jobId ? jobs.find(j => j.id === jobId) : null;
  if (jobId && !editing) {
    return <Page breadcrumb={[{ label: 'Requests', to: '/app/requests' }, { label: 'Edit' }]}><Card><EmptyState title="Request not found" /></Card></Page>;
  }
  if (editing && (!isNewJob(editing.status) || editing.acknowledgedAt)) {
    return <Page breadcrumb={[{ label: 'Requests', to: '/app/requests' }, { label: editing.jobNumber, to: `/app/requests/${editing.id}` }, { label: 'Edit' }]}>
      <Card><EmptyState title="This request can no longer be edited" action={<Button to={`/app/requests/${editing.id}`} variant="secondary">Back to the request</Button>}>SACC has already acknowledged it. Call <HotlineLink /> if something has changed.</EmptyState></Card>
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
  const [category, setCategory] = useState(job?.category || (config.incidentCategories || [])[0] || '');
  const [waterType, setWaterType] = useState(job?.waterType || 'NONE');
  const [hazards, setHazards] = useState(job?.hazards || []);
  const [noPhotos, setNoPhotos] = useState(false);
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
  const { errors, check, clear, fromServer } = useFieldErrors();
  const edit = (setter, field) => (v) => { setter(v); clear(field); };

  const loc = locations.find(l => l.id === locId) || firstLoc;

  const onLocation = (id) => {
    setLocId(id);
    const l = locations.find(x => x.id === id);
    if (l?.accessInstructions) setAccessInstructions(l.accessInstructions);
    setAccessRestrictions(l?.securityNotes || '');
    setParkingInstructions(l?.parkingNotes || '');
  };

  // Each file is uploaded on its own (POST /api/files); the request keeps only the URL that comes back
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const readFiles = (input, setter, kind) => {
    const files = Array.from(input.files || []);
    input.value = '';
    setUploadError('');
    files.forEach(async (file) => {
      setUploading(n => n + 1);
      try {
        const url = await uploadFile(file, kind, job?.id);
        setter(prev => [...prev, url]);
        clear('photos');
      } catch (err) {
        setUploadError(`${file.name}: ${err.message}`);
      } finally {
        setUploading(n => n - 1);
      }
    });
  };

  const addLink = () => {
    const v = linkInput.trim();
    if (!v) return;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(v)) setVideos(p => [...p, v]); else setPhotos(p => [...p, v]);
    setLinkInput('');
  };

  // Each message shows under its own field; the first wrong field gets the focus
  const validate = () => check({
    description: v => (String(v.description || '').trim().length < 5 ? 'Describe what happened (at least 5 characters).' : ''),
    affectedArea: v => numberError(v.affectedArea, { label: 'Affected area', min: 1, max: 100000 }),
    incidentTime: v => (!v.incidentTime ? 'Enter when it happened.' : new Date(v.incidentTime) > new Date(Date.now() + 5 * 60000) ? 'The time cannot be in the future.' : ''),
    onsiteContact: v => personNameError(v.onsiteContact, { label: 'On-site contact name' }),
    onsitePhone: v => phoneError(v.onsitePhone),
    accessInstructions: v => (String(v.accessInstructions || '').trim().length < 3 ? 'Tell the technician how to get in, e.g. keypad code or who meets them.' : ''),
    // Clear photos help SACC assess the request (cl. 12.1, 12.2)
    photos: () => (!job && !photos.length && !linkInput.trim() && !noPhotos ? 'Add at least one photo, or tick that you cannot take one.' : '')
  }, { description, affectedArea, incidentTime, onsiteContact, onsitePhone, accessInstructions });

  const warnings = coverageWarnings({ category, affectedArea, waterType, hazards }, config);
  const sitePlan = (config.membershipPlans || []).find(p => p.id === (loc.membershipPlan || account.membershipPlan));
  const now = new Date();
  const surcharge = sitePlan ? surchargeFor(sitePlan, now, config) : { amount: 0 };
  const essentialAfterHours = sitePlan?.window && isAfterHours(now);
  const toggleHazard = (id) => setHazards(h => (h.includes(id) ? h.filter(x => x !== id) : [...h, id]));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setSaving(true);
    const body = {
      locationId: loc.id, locationName: loc.name, address: loc.address,
      category, description, affectedArea: parseFloat(affectedArea) || 0, waterType, hazards, incidentTime, isOngoing, isSafeToAccess: isSafe,
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
        if (!fromServer(data)) setError(msg);
        setSaving(false);
        return;
      }
      upsertJob(data);
      notify(job ? 'Your changes were saved.' : `Request ${data.jobNumber || ''} sent. We will acknowledge it shortly; the 2–4 hour target starts then.`);
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
          <Alert tone="danger">{error}</Alert>
          <Alert tone="warning"><strong>A responsible person must be on site</strong> when the technician arrives, unless other access was agreed in writing. If nobody can let us in, the call-out is used and a {fmtMoney(config.missedAccessFee)} + GST fee applies. Urgent? Call <HotlineLink />.</Alert>
          {!job && summary.suspended && <Alert tone="danger">Your membership payment is overdue, so this visit is charged as an additional call-out until it is paid.</Alert>}
          {!job && summary.membership.inWaitingPeriod && <Alert tone="info">You are in the first 10 days of membership. We will attend where possible; a one-off {fmtMoney(config.earlyActivationFee)} + GST early activation fee applies (cl. 3.2).</Alert>}
          {!job && essentialAfterHours && <Alert tone="info">It is after hours. The {sitePlan.name} plan covers 6:00 am to 9:00 pm, so attendance now is at SACC's discretion with a {fmtMoney(config.surchargeAmount)} + GST surcharge; otherwise the response clock starts at 6:00 am.</Alert>}
          {!job && !essentialAfterHours && surcharge.amount > 0 && <Alert tone="info">{surcharge.reason}: a {fmtMoney(surcharge.amount)} + GST surcharge applies to visits at this time.</Alert>}

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
              {/toilet/i.test(category) && <Alert tone="info" className="md:col-span-2">{config.toiletOverflowDisclaimer}</Alert>}
              <Field label="What happened?" required className="md:col-span-2" error={errors.description}>
                <textarea rows={3} className={inputCls} value={description} onChange={e => edit(setDescription, 'description')(e.target.value)} placeholder="Describe the incident, the cause and what is affected…" />
              </Field>
              <Field label="Affected area (m²)" required error={errors.affectedArea}>
                <input type="text" inputMode="decimal" className={inputCls} value={affectedArea} onChange={e => edit(setAffectedArea, 'affectedArea')(e.target.value.replace(/[^\d.]/g, ''))} />
              </Field>
              <Field label="When did it happen?" required error={errors.incidentTime}>
                <input type="datetime-local" className={inputCls} value={incidentTime} onChange={e => edit(setIncidentTime, 'incidentTime')(e.target.value)} />
              </Field>
              <Field label="Is water involved?" className="md:col-span-2">
                <select className={inputCls} value={waterType} onChange={e => setWaterType(e.target.value)}>
                  {WATER_TYPES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              </Field>
              {warnings.length > 0 && (
                <Alert tone="warning" className="md:col-span-2">
                  <strong>This may be outside membership cover.</strong> SACC will confirm when it acknowledges your request; quoted work does not use a call-out.
                  <ul className="mt-1 list-disc pl-5">{warnings.map(w => <li key={w}>{w}</li>)}</ul>
                </Alert>
              )}
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
              <Field label="Hazards on site" as="div" className="md:col-span-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  {HAZARDS.map(h => (
                    <label key={h.id} className={cx('flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium', hazards.includes(h.id) ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-300 text-slate-700')}>
                      <input type="checkbox" checked={hazards.includes(h.id)} onChange={() => toggleHazard(h.id)} className="h-4 w-4 accent-amber-600" />{h.label}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </Card>

          <Card title="3. On-site contact and access" icon={User}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="On-site contact name" required error={errors.onsiteContact}><input className={inputCls} value={onsiteContact} onChange={e => edit(setOnsiteContact, 'onsiteContact')(e.target.value)} autoComplete="name" /></Field>
              <Field label="On-site contact phone" required error={errors.onsitePhone}><PhoneInput value={onsitePhone} onChange={edit(setOnsitePhone, 'onsitePhone')} /></Field>
              <Field label="Access instructions" required className="md:col-span-2" error={errors.accessInstructions}><input className={inputCls} value={accessInstructions} onChange={e => edit(setAccessInstructions, 'accessInstructions')(e.target.value)} placeholder="Keypad code, lockbox, gate entry…" /></Field>
              <Field label="Access restrictions"><input className={inputCls} value={accessRestrictions} onChange={e => setAccessRestrictions(e.target.value)} placeholder="PPE, height limits, security clearance…" /></Field>
              <Field label="Parking or security"><input className={inputCls} value={parkingInstructions} onChange={e => setParkingInstructions(e.target.value)} placeholder="Loading bay, visitor parking, security desk…" /></Field>
            </div>
          </Card>

          <Card title="4. Photos and videos" icon={Camera}>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">
                <Camera className="h-4 w-4" /> Take or add photos
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => readFiles(e.target, setPhotos, 'photo')} />
              </label>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <UploadCloud className="h-4 w-4" /> Add videos
                <input type="file" accept="video/*" multiple className="hidden" onChange={e => readFiles(e.target, setVideos, 'video')} />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <input className={inputCls} value={linkInput} onChange={e => setLinkInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} placeholder="…or paste a photo or video link" />
              <Button variant="secondary" onClick={addLink} title="Add this photo or video link to the request">Add</Button>
            </div>
            {(photos.length > 0 || videos.length > 0) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.map((src, i) => (
                  <div key={`p${i}`} className="relative">
                    <img src={src} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
                    <button type="button" onClick={() => setPhotos(photos.filter((_, x) => x !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-1 text-white shadow cursor-pointer" aria-label="Remove photo" title="Remove this photo"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {videos.map((src, i) => (
                  <div key={`v${i}`} className="relative flex h-20 w-32 items-center justify-center rounded-xl bg-slate-900 px-2 text-center text-[10px] text-slate-200">
                    Video {i + 1}
                    <button type="button" onClick={() => setVideos(videos.filter((_, x) => x !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-1 text-white shadow cursor-pointer" aria-label="Remove video" title="Remove this video"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-xs text-slate-500">Clear photos help SACC confirm the cover and bring the right equipment.</p>}
            {!job && !photos.length && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={noPhotos} onChange={e => { setNoPhotos(e.target.checked); clear('photos'); }} className="h-4 w-4 accent-[#0286cd]" />
                I can't take a photo right now (SACC may call to ask for one)
              </label>
            )}
            {uploading > 0 && <p className="mt-2 text-sm font-medium text-slate-600">Uploading {uploading} file{uploading > 1 ? 's' : ''}…</p>}
            {uploadError && <p className="mt-2 text-sm font-medium text-red-600">{uploadError}</p>}
            {errors.photos && <p className="mt-2 text-sm font-medium text-red-600">{errors.photos}</p>}
          </Card>

          <StickyActions className="xl:hidden">
            <Button variant="ghost" onClick={() => navigate(-1)} title="Go back without sending">Cancel</Button>
            <Button type="submit" variant={job ? 'primary' : 'emergency'} icon={job ? Save : Siren} disabled={saving || uploading > 0} title={job ? 'Save the changes to this request' : 'Send the emergency request to our dispatch team'}>{uploading > 0 ? 'Uploading…' : saving ? 'Sending…' : job ? 'Save changes' : 'Send request'}</Button>
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
                    ? <span>All {summary.included} included call-outs are used this month. If SACC confirms this is covered, it is an extra call-out at {fmtMoney(summary.membership.additionalCalloutFee ?? config.additionalCalloutFee)} + GST, including the first hour. <Link to="/app/membership/change" className="font-semibold underline">Compare plans</Link></span>
                    : <span><strong>{summary.remaining} of {summary.included}</strong> included call-outs left this month. One is used once SACC confirms the request is covered.</span>}
                </div>
              </Card>
            )}
            <Button type="submit" variant={job ? 'primary' : 'emergency'} size="lg" block icon={job ? Save : Siren} disabled={saving || uploading > 0} title={job ? 'Save the changes to this request' : 'Send the emergency request to our dispatch team'}>{uploading > 0 ? 'Uploading…' : saving ? 'Sending…' : job ? 'Save changes' : 'Send emergency request'}</Button>
            <Button variant="ghost" block onClick={() => navigate(-1)} title="Go back without sending">Cancel</Button>
          </div>
        </aside>
      </form>
    </Page>
  );
}
