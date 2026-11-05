import React, { useState } from 'react';
import {
  ShieldAlert, AlertTriangle, PlusCircle, User, Building, UploadCloud, AlertCircle, X, Camera
} from 'lucide-react';

/* =========================================================================
   NEW EMERGENCY REQUEST MODAL
   ========================================================================= */
/* =========================================================================
   NEW EMERGENCY REQUEST MODAL COMPONENT
   ========================================================================= */
export function NewEmergencyRequestModal({ account, config, onClose, onSubmit }) {
  const [selectedLocId, setSelectedLocId] = useState(account.locations?.[0]?.id || 'loc-1');
  const [category, setCategory] = useState('Toilet overflow');
  const [description, setDescription] = useState('');
  const [affectedArea, setAffectedArea] = useState('');
  const [incidentTime, setIncidentTime] = useState(new Date().toISOString().slice(0, 16));
  const [isOngoing, setIsOngoing] = useState(false);
  const [isSafeToAccess, setIsSafeToAccess] = useState(true);
  const [onsiteContact, setOnsiteContact] = useState(account.primaryContactName || account.primaryContact || '');
  const [onsitePhone, setOnsitePhone] = useState(account.phoneNumber || account.phone || '');
  const [accessInstructions, setAccessInstructions] = useState(account.locations?.[0]?.accessInstructions || '');
  const [accessRestrictions, setAccessRestrictions] = useState(account.locations?.[0]?.securityNotes || '');
  const [parkingInstructions, setParkingInstructions] = useState(account.locations?.[0]?.parkingNotes || '');
  
  // Media Uploads
  const [photoUrls, setPhotoUrls] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);
  const [newPhotoInput, setNewPhotoInput] = useState('');
  const [newVideoInput, setNewVideoInput] = useState('');

  // Handle Location Change to sync default access instructions
  const handleLocationChange = (locId) => {
    setSelectedLocId(locId);
    const loc = (account.locations || []).find(l => l.id === locId);
    if (loc) {
      if (loc.accessInstructions) setAccessInstructions(loc.accessInstructions);
      if (loc.securityNotes) setParkingInstructions(loc.securityNotes);
    }
  };

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

  const addSamplePhoto = (e) => {
    if (e) e.preventDefault();
    const samples = [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=600&q=80'
    ];
    const pick = samples[photoUrls.length % samples.length];
    setPhotoUrls(prev => [...prev, pick]);
  };

  const addSampleVideo = (e) => {
    if (e) e.preventDefault();
    const sampleVideo = 'https://assets.mixkit.co/videos/preview/mixkit-water-leaking-from-a-ceiling-pipe-42861-large.mp4';
    setVideoUrls(prev => [...prev, sampleVideo]);
  };

  const [calloutFormError, setCalloutFormError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setCalloutFormError('');

    if (!description || description.trim().length < 5) {
      setCalloutFormError('Validation Error: Please provide a detailed description of the incident (at least 5 characters).');
      return;
    }
    if (isNaN(Number(affectedArea)) || Number(affectedArea) <= 0) {
      setCalloutFormError('Validation Error: Please enter a valid positive number for affected area (m²).');
      return;
    }
    if (!onsiteContact || onsiteContact.trim().length < 2) {
      setCalloutFormError('Validation Error: Onsite contact person name is required (at least 2 characters).');
      return;
    }
    const cleanPhone = onsitePhone.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      setCalloutFormError('Validation Error: Please enter a valid Australian phone number (8 to 12 digits).');
      return;
    }

    const loc = (account.locations || []).find(l => l.id === selectedLocId) || account.locations?.[0] || {};
    
    // Auto-commit any text typed into input boxes
    let finalPhotos = [...photoUrls];
    if (newPhotoInput.trim() && !finalPhotos.includes(newPhotoInput.trim())) {
      finalPhotos.push(newPhotoInput.trim());
    }

    let finalVideos = [...videoUrls];
    if (newVideoInput.trim() && !finalVideos.includes(newVideoInput.trim())) {
      finalVideos.push(newVideoInput.trim());
    }

    onSubmit({
      organizationId: account.id,
      locationId: loc.id || 'loc-1',
      customerName: account.businessName,
      locationName: loc.name || 'Adelaide CBD Headquarters',
      address: loc.address || '120 Grenfell Street, Adelaide SA 5000',
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
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[90vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#0286cd]" />
              Request Emergency Cleaning Dispatch
            </h3>
            <p className="text-xs text-slate-600">Complete all required incident, site access & contact details</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {/* Mandatory On-site Staff Representative Presence Disclaimer */}
        <div className="bg-amber-50 border-l-4 border-l-amber-500 border border-amber-200 p-3.5 rounded-2xl text-amber-900 space-y-1">
          <div className="font-extrabold flex items-center gap-2 text-xs text-amber-800 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Mandatory Representative Presence Required On-Site
          </div>
          <p className="text-[11px] text-slate-700 leading-relaxed">
            <strong>Advisory Notice:</strong> A staff member or authorized business representative MUST be present on-site when our SACC technician arrives, unless alternative access arrangements have been previously approved by management.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {calloutFormError && (
            <div className="bg-red-50 border-l-4 border-l-red-600 p-3.5 rounded-2xl text-red-900 font-extrabold text-xs flex items-center gap-2 shadow-sm border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{calloutFormError}</span>
            </div>
          )}
          {/* SECTION 1: Service Location & Incident Type */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <Building className="w-4 h-4" /> 1. Location & Incident Classification
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">1. Service Location <span className="text-red-500">*</span></label>
                <select
                  value={selectedLocId}
                  onChange={(e) => handleLocationChange(e.target.value)}
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

            {/* Toilet Overflow Policy Disclaimer Banner */}
            {category === 'Toilet overflow' && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-[11px] text-[#0286cd]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Toilet Overflow Scope Notice:
                </div>
                <p className="text-[10px] text-slate-700">{config.toiletOverflowDisclaimer}</p>
              </div>
            )}

            <div>
              <label className="block text-slate-700 mb-1 font-bold">3. Description of What Happened <span className="text-red-500">*</span></label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide detailed description of the incident, cause, and affected items..."
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
                  placeholder="e.g. 25"
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
                    <input type="radio" name="isOngoing" checked={isOngoing} onChange={() => setIsOngoing(true)} className="text-[#0286cd]" />
                    <span>Yes (Active Flow/Leak)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="isOngoing" checked={!isOngoing} onChange={() => setIsOngoing(false)} className="text-[#0286cd]" />
                    <span>No (Stopped/Contained)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">7. Is Area Safe to Access?</label>
                <div className="flex gap-4 items-center bg-white p-2.5 rounded-xl border border-slate-300">
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="isSafe" checked={isSafeToAccess} onChange={() => setIsSafeToAccess(true)} className="text-[#0286cd]" />
                    <span>Yes (Safe for Tech)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="isSafe" checked={!isSafeToAccess} onChange={() => setIsSafeToAccess(false)} className="text-[#0286cd]" />
                    <span>No (Hazards Present)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Onsite Contact Person & Site Access Instructions */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <User className="w-4 h-4" /> 2. On-Site Contact & Security Access Instructions
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">8. Onsite Contact Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={onsiteContact}
                  onChange={(e) => setOnsiteContact(e.target.value)}
                  placeholder="Full name of person on site"
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
                  placeholder="e.g. 0412 345 678"
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
                placeholder="Keypad code, lockbox location, gate entry procedures..."
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
                  placeholder="Height clearances, PPE requirements, security clearance..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">12. Parking or Security Instructions</label>
                <input
                  type="text"
                  value={parkingInstructions}
                  onChange={(e) => setParkingInstructions(e.target.value)}
                  placeholder="Loading bay, security desk check-in, visitor bays..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Multiple Incident Photos & Short Videos Upload */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <Camera className="w-4 h-4" /> 3. Upload Incident Photos & Short Video Clips
            </h4>

            {/* Photos Upload */}
            <div className="space-y-3">
              <label className="block text-slate-800 font-bold">Photo Uploads (Image Files or URLs)</label>
              
              <div className="flex flex-wrap gap-2 items-center">
                {/* File Upload Button */}
                <label className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3.5 py-2 rounded-xl cursor-pointer text-xs flex items-center gap-1.5 shadow-sm">
                  <UploadCloud className="w-4 h-4" />
                  <span>Choose Image File(s)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={addSamplePhoto}
                  className="bg-blue-100 hover:bg-blue-200 text-[#0286cd] font-bold px-3 py-2 rounded-xl border border-blue-300 text-xs cursor-pointer"
                >
                  + Add Sample Photo
                </button>
              </div>

              {/* URL Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPhotoInput}
                  onChange={(e) => setNewPhotoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addPhotoUrl(e); }}
                  placeholder="Or paste photo image URL link..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
                <button
                  type="button"
                  onClick={addPhotoUrl}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  + Add Link
                </button>
              </div>

              {photoUrls.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pt-1 pb-1">
                  {photoUrls.map((src, i) => (
                    <div key={i} className="relative group flex-shrink-0">
                      <img src={src} alt="Incident Photo" className="w-20 h-20 object-cover rounded-xl border border-slate-300 shadow-sm" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 cursor-pointer"
                        title="Remove Photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No incident photos added yet.</p>
              )}
            </div>

            {/* Short Videos Upload */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <label className="block text-slate-800 font-bold">Video Uploads (Short Incident Video Clips)</label>
              
              <div className="flex flex-wrap gap-2 items-center">
                {/* Video File Upload Button */}
                <label className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-3.5 py-2 rounded-xl cursor-pointer text-xs flex items-center gap-1.5 shadow-sm">
                  <UploadCloud className="w-4 h-4" />
                  <span>Choose Video File(s)</span>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideoFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={addSampleVideo}
                  className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold px-3 py-2 rounded-xl border border-purple-300 text-xs cursor-pointer"
                >
                  + Add Sample Video
                </button>
              </div>

              {/* Video URL Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVideoInput}
                  onChange={(e) => setNewVideoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addVideoUrl(e); }}
                  placeholder="Or paste video MP4 link..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
                <button
                  type="button"
                  onClick={addVideoUrl}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  + Add Link
                </button>
              </div>

              {videoUrls.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pt-1 pb-1">
                  {videoUrls.map((src, i) => (
                    <div key={i} className="relative bg-slate-900 p-2 rounded-xl text-white text-[10px] space-y-1 flex flex-col justify-between w-40 flex-shrink-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold truncate text-purple-300">📹 Video Clip #{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeVideo(i)}
                          className="bg-red-600 text-white rounded-full p-0.5 shadow hover:bg-red-700 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-slate-300 font-mono text-[9px] truncate">{src}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No incident video clips added yet.</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-black py-4 rounded-2xl text-xs sm:text-sm transition-all shadow-xl cursor-pointer border border-blue-400 flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-5 h-5 text-white" />
            SUBMIT EMERGENCY CLEANING DISPATCH REQUEST
          </button>
        </form>
      </div>
    </div>
  );
}
