import React, { useState } from 'react';
import {
  CheckCircle2, User, Building, UploadCloud, X, Camera, Edit3
} from 'lucide-react';

/* =========================================================================
   EDIT EMERGENCY REQUEST MODAL COMPONENT (Allowed when status is SUBMITTED)
   ========================================================================= */
export function EditEmergencyRequestModal({ job, account, config, onClose, onSave }) {
  const [selectedLocId, setSelectedLocId] = useState(job.locationId || account.locations?.[0]?.id || 'loc-1');
  const [category, setCategory] = useState(job.category || 'Toilet overflow');
  const [description, setDescription] = useState(job.description || '');
  const [affectedArea, setAffectedArea] = useState(job.affectedArea ? String(job.affectedArea) : '25');
  const [incidentTime, setIncidentTime] = useState(
    job.incidentTime 
      ? new Date(job.incidentTime).toISOString().slice(0, 16) 
      : new Date().toISOString().slice(0, 16)
  );
  const [isOngoing, setIsOngoing] = useState(job.isOngoing !== undefined ? job.isOngoing : false);
  const [isSafeToAccess, setIsSafeToAccess] = useState(job.isSafeToAccess !== undefined ? job.isSafeToAccess : true);
  const [onsiteContact, setOnsiteContact] = useState(job.onsiteContact || '');
  const [onsitePhone, setOnsitePhone] = useState(job.onsitePhone || '');
  const [accessInstructions, setAccessInstructions] = useState(job.accessInstructions || '');
  const [accessRestrictions, setAccessRestrictions] = useState(job.accessRestrictions || '');
  const [parkingInstructions, setParkingInstructions] = useState(job.parkingInstructions || '');
  
  // Media Uploads
  const initialPhotos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
  const initialVideos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');
  const [photoUrls, setPhotoUrls] = useState(initialPhotos);
  const [videoUrls, setVideoUrls] = useState(initialVideos);
  const [newPhotoInput, setNewPhotoInput] = useState('');
  const [newVideoInput, setNewVideoInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handlePhotoFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrls(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setVideoUrls(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const addPhotoUrl = (e) => {
    if (e) e.preventDefault();
    if (newPhotoInput.trim()) {
      setPhotoUrls(prev => [...prev, newPhotoInput.trim()]);
      setNewPhotoInput('');
    }
  };

  const removePhoto = (index) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index));
  };

  const addVideoUrl = (e) => {
    if (e) e.preventDefault();
    if (newVideoInput.trim()) {
      setVideoUrls(prev => [...prev, newVideoInput.trim()]);
      setNewVideoInput('');
    }
  };

  const removeVideo = (index) => {
    setVideoUrls(videoUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const loc = (account.locations || []).find(l => l.id === selectedLocId) || account.locations?.[0] || {};

    let finalPhotos = [...photoUrls];
    if (newPhotoInput.trim() && !finalPhotos.includes(newPhotoInput.trim())) {
      finalPhotos.push(newPhotoInput.trim());
    }

    let finalVideos = [...videoUrls];
    if (newVideoInput.trim() && !finalVideos.includes(newVideoInput.trim())) {
      finalVideos.push(newVideoInput.trim());
    }

    await onSave({
      locationId: loc.id || job.locationId,
      locationName: loc.name || job.locationName,
      address: loc.address || job.address,
      category,
      description,
      affectedArea: parseFloat(affectedArea) || 0,
      incidentTime,
      isOngoing,
      isSafeToAccess,
      onsiteContact,
      onsitePhone,
      accessInstructions,
      accessRestrictions,
      parkingInstructions,
      photos: finalPhotos,
      videos: finalVideos
    });
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[90vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-extrabold text-[#0286cd] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {job.jobNumber || job.id}
              </span>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                Status: SUBMITTED (Awaiting Acceptance)
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-1">
              <Edit3 className="w-5 h-5 text-amber-500" />
              Edit Unaccepted Emergency Request
            </h3>
            <p className="text-xs text-slate-600">Update incident details, site access, or media prior to admin acceptance</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* SECTION 1: Service Location & Incident Type */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <Building className="w-4 h-4" /> 1. Location & Incident Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">1. Service Location <span className="text-red-500">*</span></label>
                <select
                  value={selectedLocId}
                  onChange={(e) => setSelectedLocId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                >
                  {(account.locations || []).map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.address})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">2. Type of Incident <span className="text-red-500">*</span></label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                >
                  {config.incidentCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">3. Description of What Happened <span className="text-red-500">*</span></label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">4. Size of Affected Area (m²) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={affectedArea}
                  onChange={(e) => setAffectedArea(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">5. When Incident Occurred <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  value={incidentTime}
                  onChange={(e) => setIncidentTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">6. Is Incident Still Ongoing?</label>
                <div className="flex gap-4 items-center bg-white p-2.5 rounded-xl border border-slate-300">
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="editIsOngoing" checked={isOngoing} onChange={() => setIsOngoing(true)} className="text-[#0286cd]" />
                    <span>Yes (Active Flow)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="editIsOngoing" checked={!isOngoing} onChange={() => setIsOngoing(false)} className="text-[#0286cd]" />
                    <span>No (Contained)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">7. Is Area Safe to Access?</label>
                <div className="flex gap-4 items-center bg-white p-2.5 rounded-xl border border-slate-300">
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="editIsSafe" checked={isSafeToAccess} onChange={() => setIsSafeToAccess(true)} className="text-[#0286cd]" />
                    <span>Yes (Safe)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="editIsSafe" checked={!isSafeToAccess} onChange={() => setIsSafeToAccess(false)} className="text-[#0286cd]" />
                    <span>No (Hazards)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Onsite Contact & Security Instructions */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <User className="w-4 h-4" /> 2. On-Site Contact & Security Access
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">8. Onsite Contact Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={onsiteContact}
                  onChange={(e) => setOnsiteContact(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">9. Onsite Contact Phone Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={onsitePhone}
                  onChange={(e) => setOnsitePhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">10. Access Instructions <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={accessInstructions}
                onChange={(e) => setAccessInstructions(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">11. Access Restrictions</label>
                <input
                  type="text"
                  value={accessRestrictions}
                  onChange={(e) => setAccessRestrictions(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">12. Parking / Security</label>
                <input
                  type="text"
                  value={parkingInstructions}
                  onChange={(e) => setParkingInstructions(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Photos & Videos */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <Camera className="w-4 h-4" /> 3. Incident Photos & Videos
            </h4>

            {/* Photo List & Add */}
            <div className="space-y-2">
              <label className="block text-slate-800 font-bold">Photos ({photoUrls.length})</label>
              <div className="flex gap-2">
                <label className="bg-[#0286cd] text-white font-bold px-3 py-2 rounded-xl cursor-pointer text-xs flex items-center gap-1">
                  <UploadCloud className="w-4 h-4" /> Add File(s)
                  <input type="file" accept="image/*" multiple onChange={handlePhotoFileUpload} className="hidden" />
                </label>
                <input
                  type="text"
                  value={newPhotoInput}
                  onChange={(e) => setNewPhotoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addPhotoUrl(e); }}
                  placeholder="Or paste photo URL..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl p-2 text-slate-900"
                />
                <button type="button" onClick={addPhotoUrl} className="bg-slate-800 text-white font-bold px-3 py-2 rounded-xl">+ Link</button>
              </div>

              <div className="flex gap-3 overflow-x-auto pt-1">
                {photoUrls.map((src, i) => (
                  <div key={i} className="relative group flex-shrink-0">
                    <img src={src} alt="Incident" className="w-16 h-16 object-cover rounded-xl border border-slate-300 shadow-sm" />
                    <button type="button" onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Video List & Add */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-slate-800 font-bold">Video Clips ({videoUrls.length})</label>
              <div className="flex gap-2">
                <label className="bg-purple-700 text-white font-bold px-3 py-2 rounded-xl cursor-pointer text-xs flex items-center gap-1">
                  <UploadCloud className="w-4 h-4" /> Add Video File(s)
                  <input type="file" accept="video/*" multiple onChange={handleVideoFileUpload} className="hidden" />
                </label>
                <input
                  type="text"
                  value={newVideoInput}
                  onChange={(e) => setNewVideoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addVideoUrl(e); }}
                  placeholder="Or paste video MP4 link..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl p-2 text-slate-900"
                />
                <button type="button" onClick={addVideoUrl} className="bg-slate-800 text-white font-bold px-3 py-2 rounded-xl">+ Link</button>
              </div>

              <div className="flex gap-3 overflow-x-auto pt-1">
                {videoUrls.map((src, i) => (
                  <div key={i} className="relative bg-slate-900 p-2 rounded-xl text-white text-[10px] flex items-center justify-between w-36 flex-shrink-0">
                    <span className="truncate text-purple-300 font-bold">📹 Clip #{i + 1}</span>
                    <button type="button" onClick={() => removeVideo(i)} className="bg-red-600 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-black py-4 rounded-2xl text-xs sm:text-sm transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            {isSaving ? 'SAVING CHANGES...' : 'SAVE & UPDATE REQUEST DETAILS'}
          </button>
        </form>
      </div>
    </div>
  );
}
