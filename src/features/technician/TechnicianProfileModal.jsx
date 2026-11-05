import React, { useState } from 'react';
import {
  CheckCircle2, User, UploadCloud, X
} from 'lucide-react';
import { API_BASE } from '@/shared/config/env.js';

/* =========================================================================
   TECHNICIAN MOBILE APP COMPONENT
   ========================================================================= */
/* =========================================================================
   TECHNICIAN PROFILE MODAL COMPONENT
   ========================================================================= */
/* =========================================================================
   TECHNICIAN PROFILE MODAL COMPONENT (EDITABLE PROFILE)
   ========================================================================= */
export function TechnicianProfileModal({ currentUser, onUpdateUser, onClose, handleLogout }) {
  const [name, setName] = useState(currentUser?.name || 'Dave Miller');
  const [phone, setPhone] = useState(currentUser?.phone || '0488 111 222');
  const [email, setEmail] = useState(currentUser?.email || 'dave.m@sacommercialcleaning.com.au');
  const [depot, setDepot] = useState(currentUser?.depot || 'Adelaide CBD Service Depot');
  const [avatar, setAvatar] = useState(currentUser?.avatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80');
  const [password, setPassword] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    try {
      const techId = currentUser?.techId || currentUser?.id;
      const res = await fetch(`${API_BASE}/technicians/${techId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password: password || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        const updated = {
          ...currentUser,
          name,
          phone,
          avatar
        };
        if (onUpdateUser) onUpdateUser(updated);
        setSavedSuccess(true);
        setTimeout(() => {
          setSavedSuccess(false);
          onClose();
        }, 1200);
      } else {
        setProfileError(data.error || 'Failed to update technician profile.');
      }
    } catch (err) {
      setProfileError('Network error: Unable to reach server.');
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[90vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-[#0286cd]" />
            Edit Field Technician Profile
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 p-3 rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Profile successfully updated & saved!
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="relative shrink-0">
              <img src={avatar} alt="Profile" className="w-16 h-16 rounded-2xl object-cover border border-slate-300 shadow-sm" />
              <label className="absolute -bottom-1 -right-1 bg-[#0286cd] text-white p-1 rounded-full cursor-pointer hover:bg-[#026fa8] shadow">
                <UploadCloud className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">Avatar Photo URL</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="Paste avatar URL..."
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-medium text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Technician Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Mobile Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Base Dispatch Depot</label>
              <input
                type="text"
                value={depot}
                onChange={(e) => setDepot(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Update Security Password (Optional)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-500 text-white font-extrabold px-4 py-3 rounded-xl shadow cursor-pointer text-xs flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> Log Out
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-3 rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-lg transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" /> Save Profile Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
