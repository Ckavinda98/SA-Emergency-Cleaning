import React, { useState } from 'react';
import {
  UploadCloud, X, Edit3
} from 'lucide-react';

/* =========================================================================
   MODAL: EDIT TECHNICIAN DETAILS
   ========================================================================= */
export function EditTechnicianModal({ tech, onClose, onSave }) {
  const [name, setName] = useState(tech?.name || '');
  const [phone, setPhone] = useState(tech?.phone || '');
  const [status, setStatus] = useState(tech?.status || 'AVAILABLE');
  const [avatar, setAvatar] = useState(tech?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80');
  const [rating, setRating] = useState(tech?.rating || 5.0);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...tech,
      name,
      phone,
      status,
      avatar,
      rating: parseFloat(rating)
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#0286cd]" />
            Edit Technician Details
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mobile Phone Number</label>
            <input required type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold">
                <option value="AVAILABLE">AVAILABLE (On Call)</option>
                <option value="ON_SITE">ON_SITE (Assigned)</option>
                <option value="OFF_DUTY">OFF_DUTY</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Rating (1.0 - 5.0)</label>
              <input type="number" step="0.1" min="1.0" max="5.0" value={rating} onChange={e => setRating(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-md transition-all cursor-pointer">
              SAVE CHANGES
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
