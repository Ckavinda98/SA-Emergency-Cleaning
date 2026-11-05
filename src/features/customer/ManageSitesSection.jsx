import React, { useState } from 'react';
import {
  MapPin, Edit3, Plus
} from 'lucide-react';
import { API_BASE } from '@/shared/config/env.js';

/* =========================================================================
   MULTI-SITE MANAGEMENT: list, add and edit a company's sites (saved to the Location table)
   ========================================================================= */
export function ManageSitesSection({ account, onSitesChanged }) {
  const emptySite = { name: '', address: '', contactName: '', contactPhone: '', accessInstructions: '', securityNotes: '' };
  const [sites, setSites] = useState(account.locations || []);
  const [editingId, setEditingId] = useState(null); // null = closed, 'new' = add form, otherwise a location id
  const [form, setForm] = useState(emptySite);
  const [busy, setBusy] = useState(false);
  const [siteMsg, setSiteMsg] = useState('');

  const openForm = (site) => {
    setSiteMsg('');
    setEditingId(site ? site.id : 'new');
    setForm(site ? {
      name: site.name || '', address: site.address || '', contactName: site.contactName || '',
      contactPhone: site.contactPhone || '', accessInstructions: site.accessInstructions || '', securityNotes: site.securityNotes || ''
    } : emptySite);
  };

  const saveSite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSiteMsg('');
    try {
      const isNew = editingId === 'new';
      const res = await fetch(isNew ? `${API_BASE}/customers/${account.id}/locations` : `${API_BASE}/locations/${editingId}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setSiteMsg(data.error || 'The site could not be saved.');
        return;
      }
      const nextSites = isNew ? [...sites, data] : sites.map(s => s.id === data.id ? data : s);
      setSites(nextSites);
      setEditingId(null);
      if (onSitesChanged) onSitesChanged({ ...account, locations: nextSites });
    } catch (err) {
      setBusy(false);
      setSiteMsg('Network error: Unable to reach the server. The site was not saved.');
    }
  };

  const field = (key, label, required = false) => (
    <div>
      <label className="block text-slate-700 font-bold mb-1">{label}{required ? ' *' : ''}</label>
      <input
        type="text"
        required={required}
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
      />
    </div>
  );

  return (
    <div className="pt-4 border-t border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-[#0286cd]" /> Service Sites ({sites.length})
        </h4>
        {editingId === null && (
          <button type="button" onClick={() => openForm(null)} className="px-3 py-1.5 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold cursor-pointer flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Site
          </button>
        )}
      </div>

      {siteMsg && <div className="p-3 bg-red-50 text-red-700 rounded-xl font-medium">{siteMsg}</div>}

      {editingId === null && (
        <div className="space-y-2">
          {sites.map(site => (
            <div key={site.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-slate-900">{site.name}</div>
                <div className="text-slate-600">{site.address}</div>
                <div className="text-[11px] text-slate-500">Contact: {site.contactName} ({site.contactPhone})</div>
              </div>
              <button type="button" onClick={() => openForm(site)} className="shrink-0 px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-white cursor-pointer flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          ))}
          {sites.length === 0 && <p className="text-slate-500">No sites yet.</p>}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={saveSite} className="space-y-3 p-3 rounded-xl border border-blue-200 bg-blue-50/40">
          <div className="font-bold text-slate-900">{editingId === 'new' ? 'Add a new site' : 'Edit site'}</div>
          {field('name', 'Site Name', true)}
          {field('address', 'Street Address (Adelaide, SA)', true)}
          <div className="grid grid-cols-2 gap-3">
            {field('contactName', 'Site Contact')}
            {field('contactPhone', 'Contact Phone')}
          </div>
          {field('accessInstructions', 'Access Instructions')}
          {field('securityNotes', 'Security / Hazard Notes')}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold cursor-pointer">
              {busy ? 'Saving...' : 'Save Site'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
