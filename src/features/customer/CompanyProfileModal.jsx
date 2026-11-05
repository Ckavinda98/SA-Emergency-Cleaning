import React, { useState } from 'react';
import {
  User, X, Trash2
} from 'lucide-react';
import { ManageSitesSection } from './ManageSitesSection.jsx';
import { API_BASE } from '@/shared/config/env.js';

/* =========================================================================
   MODAL: COMPANY PROFILE & PASSWORD UPDATE
   ========================================================================= */
export function CompanyProfileModal({ account, onClose, onUpdateSuccess, onSitesChanged, handleLogout }) {
  const [businessName, setBusinessName] = useState(account.businessName || '');
  const [primaryContactName, setPrimaryContactName] = useState(account.primaryContactName || account.primaryContact || '');
  const [phoneNumber, setPhoneNumber] = useState(account.phoneNumber || account.phone || '');
  const [email, setEmail] = useState(account.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState('');

  const handleDeleteAccount = async () => {
    if (!window.confirm("WARNING: Are you sure you want to permanently delete your account and all associated data? This action cannot be undone and complies with Apple App Store review guidelines.")) return;
    setDeleting(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert("Account deleted successfully.");
        if (handleLogout) handleLogout();
      } else {
        const data = await res.json();
        setMsg(data.error || 'Failed to delete account.');
        setDeleting(false);
      }
    } catch (err) {
      setMsg("Network error occurred while trying to delete the account.");
      setDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');

    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, primaryContactName, phoneNumber, email, password: newPassword || undefined })
      });
      const data = await res.json();
      setSaving(false);
      if (res.ok && data.customer) {
        onUpdateSuccess(data.customer);
      } else {
        setMsg(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setSaving(false);
      setMsg('Network error: Unable to update profile on server.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[92vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-[#0286cd]" />
            Company Profile & Account Security
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {msg && <div className="p-3 bg-red-50 text-red-700 rounded-xl font-medium">{msg}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Company Name</label>
            <input type="text" required value={businessName} onChange={e => setBusinessName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Primary Contact</label>
              <input type="text" required value={primaryContactName} onChange={e => setPrimaryContactName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
              <input type="text" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <div className="pt-2 border-t border-slate-200">
            <label className="block text-slate-700 font-bold mb-1">Update Password (Optional)</label>
            <input type="password" placeholder="Leave blank to keep current password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <div className="pt-3 flex justify-between gap-2 border-t border-slate-200 mt-4">
            <button type="button" onClick={handleDeleteAccount} disabled={deleting} className="px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-bold cursor-pointer transition-colors flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete Account'}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving || deleting} className="px-6 py-2.5 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold cursor-pointer shadow-md">
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </div>
        </form>

        <ManageSitesSection account={account} onSitesChanged={onSitesChanged} />
      </div>
    </div>
  );
}
