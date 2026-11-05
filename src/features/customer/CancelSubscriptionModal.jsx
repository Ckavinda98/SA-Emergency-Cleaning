import React, { useState } from 'react';
import {
  AlertTriangle, X
} from 'lucide-react';
import { API_BASE } from '@/shared/config/env.js';

/* =========================================================================
   MODAL: CANCEL SUBSCRIPTION
   ========================================================================= */
export function CancelSubscriptionModal({ account, onClose, onCancelSuccess }) {
  const [confirmed, setConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/cancel-subscription`, { method: 'POST' });
      const data = await res.json();
      setCancelling(false);
      onCancelSuccess(data.customer || { ...account, subscriptionStatus: 'CANCELLED' });
    } catch (e) {
      setCancelling(false);
      onCancelSuccess({ ...account, subscriptionStatus: 'CANCELLED' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-6 rounded-3xl space-y-4 border border-red-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-red-600">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Cancel Membership Subscription
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-slate-600 leading-relaxed font-medium">
          Are you sure you want to cancel the Emergency Cleaning Membership for <strong>{account.businessName}</strong>?
        </p>

        <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-800 text-[11px] space-y-1">
          <p className="font-bold">Important Notice:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Your 2–4 Hour SLA priority attendance will be deactivated.</li>
            <li>Unredeemed Reward Points balance will be frozen.</li>
          </ul>
        </div>

        <label className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 text-red-600 rounded" />
          <span className="font-bold text-slate-800 text-[11px]">I confirm that I wish to cancel this membership subscription.</span>
        </label>

        <div className="pt-2 flex justify-between">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Keep Membership</button>
          <button type="button" disabled={!confirmed || cancelling} onClick={handleCancel} className={`px-5 py-2 rounded-xl font-bold cursor-pointer ${confirmed ? 'bg-red-600 hover:bg-red-700 text-white shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
            {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
