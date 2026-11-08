// On-site record for the technician (Operations SOP, Service Report Template sections 2–7):
// before/after photos, measured area, work done, waste, equipment, checklist and the site sign-off.
// Missed access (cl. 12.4) and on-site reclassification (cl. 9.3) have their own forms.
import React, { useEffect, useRef, useState } from 'react';
import { Camera, Ruler, ClipboardList, PenLine, Trash2, Plus, AlertTriangle, DoorClosed, Save, ListChecks, X } from 'lucide-react';
import { useAppData } from '@/app/AppData.jsx';
import { useJobAction } from '@/app/useJobAction.js';
import { Card, Button, Field, Alert, InlineConfirm, inputCls, cx } from '@/shared/ui/index.jsx';
import { REPORT_CHECKLIST, parseList } from '@shared/membership.js';
import { uploadFile } from '@/shared/api/files.js';

// Phone photos are large: shrink to 1280px JPEG before sending
export function shrinkImage(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function PhotoPicker({ label, photos, onChange, disabled, required, jobId }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  // Each photo is shrunk and uploaded (POST /api/files); the job keeps only the URLs
  const add = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 12 - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setFailed('');
    try {
      const shots = await Promise.all(files.map(f => uploadFile(f, 'photo', jobId)));
      onChange([...photos, ...shots]);
    } catch (err) {
      setFailed(err.message);
    }
    setBusy(false);
  };
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-slate-600">{label}{required && <span className="text-red-500"> *</span>}</div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
            <img src={p} alt="" className="h-full w-full object-cover" />
            {!disabled && (
              <button type="button" title="Remove this photo" onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute right-0.5 top-0.5 cursor-pointer rounded-full bg-white/90 p-0.5 text-slate-700 shadow"><X className="h-3 w-3" /></button>
            )}
          </div>
        ))}
        {!disabled && photos.length < 12 && (
          <label title={`Add ${label.toLowerCase()}`} className={cx('flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-500', busy ? 'opacity-60' : 'cursor-pointer hover:border-brand hover:text-brand')}>
            <Camera className="h-5 w-5" />{busy ? 'Uploading…' : 'Add'}
            <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={add} disabled={busy} />
          </label>
        )}
      </div>
      {failed && <p className="mt-1 text-xs font-medium text-red-600">{failed}</p>}
    </div>
  );
}

// Finger or mouse signature; returns a PNG data URL
function SignaturePad({ onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const inked = useRef(false);
  useEffect(() => {
    const c = ref.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { drawing.current = true; ref.current.setPointerCapture(e.pointerId); const ctx = ref.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  const move = (e) => { if (!drawing.current) return; const ctx = ref.current.getContext('2d'); ctx.lineTo(...pos(e)); ctx.stroke(); if (!inked.current) { inked.current = true; setEmpty(false); } };
  const up = () => { if (!drawing.current) return; drawing.current = false; onChange(inked.current ? ref.current.toDataURL('image/png') : ''); };
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); inked.current = false; setEmpty(true); onChange(''); };
  return (
    <div>
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        className="h-32 w-full touch-none rounded-lg border border-slate-300 bg-white" aria-label="Signature pad" />
      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
        <span>{empty ? 'Site representative signs here' : 'Signed'}</span>
        <button type="button" className="cursor-pointer font-semibold text-brand" onClick={clear}>Clear</button>
      </div>
    </div>
  );
}

const TEXT_FIELDS = [
  { id: 'causeOfIncident', label: 'Cause of incident', placeholder: 'e.g. burst flexi hose under kitchen sink' },
  { id: 'surfacesAffected', label: 'Surfaces affected', placeholder: 'e.g. carpet tiles, skirting, vinyl' },
  { id: 'methodUsed', label: 'Method used', placeholder: 'e.g. extraction, antimicrobial treatment, drying' },
  { id: 'equipmentUsed', label: 'Equipment used', placeholder: 'e.g. truck mount extractor, 2 air movers' },
  { id: 'productsUsed', label: 'Products used', placeholder: 'e.g. hospital-grade disinfectant' },
  { id: 'recommendations', label: 'Recommendations for the member', placeholder: 'e.g. plumber to replace hose' }
];

const recordFrom = (job) => ({
  measuredArea: job.measuredArea ?? '',
  technicianCount: job.technicianCount || 1,
  ...Object.fromEntries(TEXT_FIELDS.map(f => [f.id, job[f.id] || ''])),
  equipmentLeft: job.equipmentLeft || '',
  equipmentCollectionAt: job.equipmentCollectionAt ? String(job.equipmentCollectionAt).slice(0, 10) : '',
  disposal: parseList(job.disposal),
  checklist: job.checklist && typeof job.checklist === 'object' ? job.checklist : {},
  siteRepName: job.siteRepName || ''
});

export function OnSiteRecord({ job }) {
  const act = useJobAction();
  const { config } = useAppData();
  const locked = Boolean(job.reportIssuedAt);
  const [form, setForm] = useState(() => recordFrom(job));
  const [dirty, setDirty] = useState(false);
  const [signature, setSignature] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!dirty) setForm(recordFrom(job)); }, [job]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };
  const before = parseList(job.beforePhotos);
  const after = parseList(job.afterPhotos);
  const working = ['IN_PROGRESS', 'COMPLETED'].includes(job.status);

  const save = async (extra = {}, msg = 'On-site record saved.') => {
    setSaving(true);
    const { disposal, ...rest } = form;
    const ok = await act(job, 'site', { ...rest, disposal: disposal.filter(d => d.item), ...extra }, msg);
    setSaving(false);
    if (ok) setDirty(false);
    return ok;
  };
  const savePhotos = (key, list) => act(job, 'site', { [key]: list }, 'Photos saved.');
  const signOff = async () => {
    if (await save({ siteRepSignature: signature }, 'Signed off by the site representative.')) setSignature('');
  };

  return (
    <Card id="onsite" title="On-site record" icon={ClipboardList} className="scroll-mt-4"
      actions={!locked && <Button size="sm" icon={Save} disabled={!dirty || saving} onClick={() => save()} title="Save the on-site details">{saving ? 'Saving…' : 'Save'}</Button>}>
      {locked && <Alert tone="info" className="mb-3">Report {job.reportNumber} has been issued. This record can no longer be changed.</Alert>}
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900"><Ruler className="h-4 w-4 text-brand" />Before you start</h3>
          <PhotoPicker jobId={job.id} label="Before photos" required photos={before} disabled={locked} onChange={(l) => savePhotos('beforePhotos', l)} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Measured area (m²)" required><input type="number" min="0" step="0.5" inputMode="decimal" className={inputCls} value={form.measuredArea} disabled={locked} onChange={e => set('measuredArea', e.target.value)} /></Field>
            <Field label="Technicians on site" hint="The first technician is included"><input type="number" min="1" max="10" className={inputCls} value={form.technicianCount} disabled={locked} onChange={e => set('technicianCount', e.target.value)} /></Field>
          </div>
        </section>

        {working && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900"><ClipboardList className="h-4 w-4 text-brand" />Work done</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {TEXT_FIELDS.map(f => (
                <Field key={f.id} label={f.label}><input className={inputCls} value={form[f.id]} placeholder={f.placeholder} disabled={locked} onChange={e => set(f.id, e.target.value)} /></Field>
              ))}
              <Field label="Equipment left on site"><input className={inputCls} value={form.equipmentLeft} placeholder="e.g. 2 dehumidifiers" disabled={locked} onChange={e => set('equipmentLeft', e.target.value)} /></Field>
              <Field label="Equipment collection date"><input type="date" className={inputCls} value={form.equipmentCollectionAt} disabled={locked} onChange={e => set('equipmentCollectionAt', e.target.value)} /></Field>
            </div>
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-slate-600">Special waste disposed (charged at cost plus a ${config.disposalHandlingFee ?? 25} handling fee per item)</div>
              {form.disposal.map((d, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input className={inputCls} placeholder="Item, e.g. biohazard bags x3" value={d.item} disabled={locked} onChange={e => set('disposal', form.disposal.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} />
                  <input type="number" min="0" step="0.01" className={cx(inputCls, 'w-28')} placeholder="Cost $" value={d.cost} disabled={locked} onChange={e => set('disposal', form.disposal.map((x, j) => (j === i ? { ...x, cost: e.target.value } : x)))} />
                  {!locked && <Button size="sm" variant="ghost" icon={Trash2} title="Remove" onClick={() => set('disposal', form.disposal.filter((_, j) => j !== i))} />}
                </div>
              ))}
              {!locked && <Button size="sm" variant="secondary" icon={Plus} onClick={() => set('disposal', [...form.disposal, { item: '', cost: '' }])}>Add waste item</Button>}
            </div>
          </section>
        )}

        {working && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900"><ListChecks className="h-4 w-4 text-brand" />Before you leave</h3>
            <PhotoPicker jobId={job.id} label="After photos" required photos={after} disabled={locked} onChange={(l) => savePhotos('afterPhotos', l)} />
            <ul className="mt-3 space-y-1.5">
              {REPORT_CHECKLIST.map(c => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand,#0b5cad)]" checked={Boolean(form.checklist[c.id])} disabled={locked} onChange={e => set('checklist', { ...form.checklist, [c.id]: e.target.checked })} />{c.label}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {working && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900"><PenLine className="h-4 w-4 text-brand" />Site sign-off</h3>
            {job.signedOffAt && job.siteRepSignature ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <img src={job.siteRepSignature} alt="Signature" className="h-12 rounded bg-white" />
                <div className="text-sm text-emerald-900"><b>{job.siteRepName}</b> signed off.{!locked && <button type="button" className="ml-2 cursor-pointer text-xs font-semibold text-brand" onClick={() => act(job, 'site', { siteRepSignature: '' }, 'Sign-off cleared.')}>Sign again</button>}</div>
              </div>
            ) : !locked && (
              <div className="space-y-2">
                <Field label="Site representative's name" required><input className={inputCls} value={form.siteRepName} onChange={e => set('siteRepName', e.target.value)} autoComplete="off" /></Field>
                <SignaturePad onChange={setSignature} />
                <Button variant="success" icon={PenLine} disabled={!signature || form.siteRepName.trim().length < 2 || saving} onClick={signOff} title="Save the record with the representative's signature">Save sign-off</Button>
              </div>
            )}
          </section>
        )}
      </div>
    </Card>
  );
}

// cl. 12.4 / SOP: wait 15 minutes from arrival, call the contact twice, photograph the entrance
export function MissedAccessForm({ job }) {
  const act = useJobAction();
  const { config } = useAppData();
  const wait = config.missedAccessWaitMinutes ?? 15;
  const needCalls = config.missedAccessCalls ?? 2;
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState(0);
  const [photo, setPhoto] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  const waited = job.arrivedAt ? Math.floor((now - new Date(job.arrivedAt)) / 60000) : 0;
  const left = Math.max(0, wait - waited);
  if (!open) return <Button variant="danger-soft" size="sm" icon={DoorClosed} onClick={() => setOpen(true)} title="Record that you cannot get into the site">Can't get in</Button>;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <div className="text-sm font-bold text-red-900">Can't get in</div>
      <p className="mt-0.5 text-xs text-red-800">Wait {wait} minutes on site and call the contact {needCalls} times. The call-out is used and a ${config.missedAccessFee ?? 100} + GST attendance fee applies.</p>
      <div className="mt-2 text-sm font-semibold text-red-900">{left ? `Waited ${waited} min: ${left} min to go` : `Waited ${waited} min`}</div>
      <div className="mt-2 flex flex-wrap gap-3">
        {Array.from({ length: needCalls }, (_, i) => (
          <label key={i} className="flex cursor-pointer items-center gap-1.5 text-sm text-red-900">
            <input type="checkbox" checked={calls > i} onChange={e => setCalls(e.target.checked ? Math.max(calls, i + 1) : i)} />Call {i + 1} made
          </label>
        ))}
        {job.onsitePhone && <a className="text-sm font-semibold text-brand underline" href={`tel:${job.onsitePhone}`}>Call {job.onsitePhone}</a>}
      </div>
      <div className="mt-2"><PhotoPicker jobId={job.id} label="Photo of the entrance" required photos={photo ? [photo] : []} onChange={l => setPhoto(l[l.length - 1] || '')} /></div>
      <Field label="Notes" className="mt-2"><input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. gate locked, no answer at reception" /></Field>
      <div className="mt-2 flex gap-2">
        <InlineConfirm label="Record missed access" icon={AlertTriangle} disabled={left > 0 || calls < needCalls || !photo}
          message="The call-out is used and the attendance fee is charged." confirmLabel="Record"
          onConfirm={() => act(job, 'missed-access', { calls, entrancePhoto: photo, notes }, 'Missed access recorded. Dispatch has been told.')} />
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Back</Button>
      </div>
    </div>
  );
}

// cl. 9.3 / SOP: on site the job turns out to be a specialist service, so it becomes a quote
export function ReclassifyForm({ job }) {
  const act = useJobAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  if (!open) return <Button variant="secondary" size="sm" icon={AlertTriangle} onClick={() => setOpen(true)} title="The job is outside membership cover and needs a quote">Outside cover: quote</Button>;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="text-sm font-bold text-amber-900">Outside membership cover</div>
      <p className="mt-0.5 text-xs text-amber-800">Stop work. The member is asked to accept a quote. No call-out is used.</p>
      <Field label="Why is it outside cover?" required className="mt-2"><textarea rows={2} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. sewage category 3, needs specialist remediation" /></Field>
      <Field label="Quote amount ex GST (optional)" hint="Leave blank for the office to price it" className="mt-2"><input type="number" min="0" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} /></Field>
      <div className="mt-2 flex gap-2">
        <InlineConfirm label="Send for quote" disabled={reason.trim().length < 5} message="The member must accept before work continues." confirmLabel="Send"
          onConfirm={() => act(job, 'reclassify', { reason, quoteAmount: amount || undefined }, 'Sent for a quote. Wait for the member to accept.')} />
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Back</Button>
      </div>
    </div>
  );
}
