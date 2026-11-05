import React, { useState } from 'react';
import {
  Wrench, UploadCloud, AlertCircle, X
} from 'lucide-react';

/* =========================================================================
   MODAL: ADD NEW TECHNICIAN (WITH PROFILE PHOTO UPLOAD)
   ========================================================================= */
export function AddTechnicianModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('AVAILABLE');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80');

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

  const [techFormError, setTechFormError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setTechFormError('');

    if (!name || name.trim().length < 2) {
      setTechFormError('Validation Error: Technician full name is required (at least 2 characters).');
      return;
    }
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      setTechFormError('Validation Error: Please enter a valid phone number (8 to 12 digits).');
      return;
    }

    onAdd({
      id: `tech-${Date.now()}`,
      name,
      phone,
      status,
      avatar,
      rating: 5.0
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#0286cd]" />
            Add New Technician to Roster
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {techFormError && (
            <div className="bg-red-50 border-l-4 border-l-red-600 p-3.5 rounded-2xl text-red-900 font-extrabold text-xs flex items-center gap-2 shadow-sm border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{techFormError}</span>
            </div>
          )}
          {/* Profile Photo Uploader & Live Preview */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <label className="block text-slate-800 font-bold text-xs">Technician Profile Photo</label>

            <div className="flex items-center gap-4">
              <img
                src={avatar}
                alt="Profile Preview"
                className="w-16 h-16 rounded-2xl object-cover border border-slate-300 shadow-md shrink-0"
              />

              <div className="space-y-2 flex-1">
                <label className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5 shadow transition-all">
                  <UploadCloud className="w-4 h-4" />
                  <span>Choose Photo File</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>

                <input
                  type="text"
                  value={avatar}
                  onChange={e => setAvatar(e.target.value)}
                  placeholder="Or paste photo URL..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-[11px] font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Technician Full Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jason Blake" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mobile Phone Number</label>
            <input required type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0499 111 222" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Initial Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold">
              <option value="AVAILABLE">AVAILABLE (On Call)</option>
              <option value="ON_SITE">ON_SITE (Assigned)</option>
            </select>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-md transition-all cursor-pointer">
              ADD TECHNICIAN TO FLEET
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
