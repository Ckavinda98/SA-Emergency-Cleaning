import React, { useState } from 'react';
import {
  AlertCircle, X, PhoneCall
} from 'lucide-react';

/* =========================================================================
   HOTLINE BOOKING MODAL
   ========================================================================= */
export function HotlineBookingModal({ account, customerAccounts = [], config, onClose, onSubmit }) {
  const [selectedOrgId, setSelectedOrgId] = useState(account?.id || (customerAccounts[0]?.id || ''));
  const selectedOrg = customerAccounts.find(c => c.id === selectedOrgId) || account;
  const [callerName, setCallerName] = useState(account?.primaryContactName || '');
  const [callerPhone, setCallerPhone] = useState(account?.phoneNumber || '');
  const [category, setCategory] = useState('Toilet overflow');
  const [address, setAddress] = useState(selectedOrg?.locations?.[0]?.address || 'Adelaide CBD SA 5000');
  const [description, setDescription] = useState('');

  const [hotlineError, setHotlineError] = useState('');

  const handleOrgChange = (newOrgId) => {
    setSelectedOrgId(newOrgId);
    const org = customerAccounts.find(c => c.id === newOrgId);
    if (org) {
      setCallerName(org.primaryContactName || '');
      setCallerPhone(org.phoneNumber || '');
      if (org.locations && org.locations.length > 0) {
        setAddress(org.locations[0].address);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setHotlineError('');

    if (!callerName || callerName.trim().length < 2) {
      setHotlineError('Validation Error: Caller name is required (at least 2 characters).');
      return;
    }
    const cleanPhone = callerPhone.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      setHotlineError('Validation Error: Please enter a valid phone number (8 to 12 digits).');
      return;
    }
    if (!address || address.trim().length < 3) {
      setHotlineError('Validation Error: Site address is required (at least 3 characters).');
      return;
    }
    if (!description || description.trim().length < 5) {
      setHotlineError('Validation Error: Please enter incident details (at least 5 characters).');
      return;
    }

    const locId = selectedOrg?.locations?.[0]?.id || null;

    onSubmit({
      organizationId: selectedOrgId || selectedOrg?.id,
      locationId: locId,
      customerName: selectedOrg?.businessName || 'Hotline Phone Caller',
      locationName: selectedOrg?.locations?.[0]?.name || 'Hotline Site Request',
      address: address || 'Adelaide CBD SA 5000',
      category,
      description: `[HOTLINE ORDER] Caller: ${callerName} (${callerPhone}) • ${description}`,
      onsiteContact: callerName,
      onsitePhone: callerPhone,
      accessInstructions: 'Operator recorded phone request',
      photos: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80']
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-red-600" />
            24/7 Hotline Phone Order Entry
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {hotlineError && (
            <div className="bg-red-50 border-l-4 border-l-red-600 p-3.5 rounded-2xl text-red-900 font-extrabold text-xs flex items-center gap-2 shadow-sm border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{hotlineError}</span>
            </div>
          )}
          {customerAccounts && customerAccounts.length > 0 && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">Select Customer Business</label>
              <select
                value={selectedOrgId}
                onChange={e => handleOrgChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
              >
                {customerAccounts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.businessName} ({c.membershipPlan.toUpperCase()} - {c.calloutsUsed || 0} callouts used)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Caller Name</label>
              <input required type="text" value={callerName} onChange={e => setCallerName(e.target.value)} placeholder="Caller Name..." className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
              <input required type="text" value={callerPhone} onChange={e => setCallerPhone(e.target.value)} placeholder="0400 000 000" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Incident Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium">
              {(config?.incidentCategories || []).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Site Address</label>
            <input required type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Site address..." className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Description</label>
            <textarea required rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Details from phone conversation..." className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold py-3 rounded-xl shadow-md transition-all cursor-pointer">
            DISPATCH EMERGENCY HOTLINE REQUEST
          </button>
        </form>
      </div>
    </div>
  );
}
