import React, { useState } from 'react';
import {
  X, Shield
} from 'lucide-react';
import { API_BASE } from '@/shared/config/env.js';

/* =========================================================================
   CHANGE PLAN MODAL COMPONENT
   ========================================================================= */
export function ChangePlanModal({ account, activePlan, config, onClose, onPlanChangeSuccess }) {
  const [selectedPlanId, setSelectedPlanId] = useState(account.membershipPlan || 'business');
  const [loading, setLoading] = useState(false);

  const handleSavePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipPlan: selectedPlanId })
      });
      const data = await res.json();
      if (data.customer) {
        onPlanChangeSuccess(data.customer);
      } else {
        onPlanChangeSuccess({ ...account, membershipPlan: selectedPlanId });
      }
    } catch (e) {
      onPlanChangeSuccess({ ...account, membershipPlan: selectedPlanId });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-xl w-full p-6 rounded-3xl space-y-6 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0286cd]" />
            Change Membership Package
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-slate-600">Choose a new emergency cleaning membership plan for <strong>{account.businessName}</strong>:</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(config.membershipPlans || []).map(plan => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                selectedPlanId === plan.id 
                  ? 'border-[#0286cd] bg-blue-50/50 shadow-md ring-2 ring-[#0286cd]/20' 
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="font-extrabold text-slate-900 text-sm">{plan.name}</div>
              <div className="text-xl font-black text-[#0286cd]">${plan.price}<span className="text-xs text-slate-500 font-normal">/mo</span></div>
              <p className="text-[11px] text-slate-600">{plan.callouts} Call-out(s) included</p>
            </div>
          ))}
        </div>

        <div className="pt-2 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSavePlan}
            disabled={loading}
            className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-md transition-all cursor-pointer"
          >
            {loading ? 'Updating Plan...' : 'Confirm Plan Change'}
          </button>
        </div>
      </div>
    </div>
  );
}
