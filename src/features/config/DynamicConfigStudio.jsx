import React, { useState } from 'react';
import {
  Settings
} from 'lucide-react';
import { API_BASE } from '@/shared/config/env.js';

/* =========================================================================
   DYNAMIC ADMIN CONFIGURATION STUDIO (ZERO-CODE RULES ENGINE)
   ========================================================================= */
export function DynamicConfigStudio({ config, setConfig }) {
  const [essentialPrice, setEssentialPrice] = useState(config.membershipPlans?.[0]?.price || 99);
  const [businessPrice, setBusinessPrice] = useState(config.membershipPlans?.[1]?.price || 199);
  const [premiumPrice, setPremiumPrice] = useState(config.membershipPlans?.[2]?.price || 399);
  const [overageRate, setOverageRate] = useState(config.overageHourlyRate || 120);
  const [additionalCalloutFee, setAdditionalCalloutFee] = useState(config.additionalCalloutFee || 30);
  const [disclaimerText, setDisclaimerText] = useState(config.toiletOverflowDisclaimer);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    const updatedPlans = (config.membershipPlans || []).map(p => {
      if (p.id === 'essential') return { ...p, price: Number(essentialPrice) };
      if (p.id === 'business') return { ...p, price: Number(businessPrice) };
      if (p.id === 'premium') return { ...p, price: Number(premiumPrice) };
      return p;
    });

    const updatedConfig = { 
      ...config, 
      membershipPlans: updatedPlans,
      overageHourlyRate: Number(overageRate),
      additionalCalloutFee: Number(additionalCalloutFee),
      toiletOverflowDisclaimer: disclaimerText 
    };

    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'The configuration was not saved.');
        return;
      }
      setConfig(updatedConfig);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      alert('Network error: Unable to reach the server. The configuration was not saved.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-2xl space-y-2 border border-slate-200 shadow-md">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600" />
          Zero-Code Admin Configuration Studio
        </h2>
        <p className="text-xs text-slate-600">
          Modify membership plan pricing, call-out allowances, hourly overage rates, and policy disclaimers live without redeploying code.
        </p>
      </div>

      {/* Plan Pricing Editor */}
      <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#0286cd]">
          Membership Plan Monthly Pricing ($AUD)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Essential Plan ($/mo)</label>
            <input 
              type="number"
              value={essentialPrice}
              onChange={(e) => setEssentialPrice(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Business Plan ($/mo)</label>
            <input 
              type="number"
              value={businessPrice}
              onChange={(e) => setBusinessPrice(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Premium Plan ($/mo)</label>
            <input 
              type="number"
              value={premiumPrice}
              onChange={(e) => setPremiumPrice(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Overage Rates Editor */}
      <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#0286cd]">
          Overage & Additional Call-out Fee Rates ($AUD)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Overage Labour Hourly Rate ($/hr)</label>
            <input 
              type="number"
              value={overageRate}
              onChange={(e) => setOverageRate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Additional Call-out Base Fee ($)</label>
            <input 
              type="number"
              value={additionalCalloutFee}
              onChange={(e) => setAdditionalCalloutFee(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Toilet Overflow Policy Disclaimer Editor */}
      <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#0286cd]">
          Toilet Overflow Policy Disclaimer Text
        </h3>
        <textarea
          rows={3}
          value={disclaimerText}
          onChange={(e) => setDisclaimerText(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-xs text-slate-900 focus:outline-none focus:border-[#0286cd] font-medium"
        />
        <div className="flex items-center justify-between">
          {savedSuccess && <span className="text-xs text-emerald-600 font-bold">✅ Rules saved to Database!</span>}
          <button
            onClick={handleSave}
            className="ml-auto bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow cursor-pointer"
          >
            Save All Configuration Rules
          </button>
        </div>
      </div>
    </div>
  );
}
