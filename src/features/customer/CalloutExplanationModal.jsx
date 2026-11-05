import React from 'react';
import {
  AlertCircle, X
} from 'lucide-react';

/* =========================================================================
   CALLOUT EXPLANATION MODAL
   ========================================================================= */
export function CalloutExplanationModal({ account, activePlan, config, onClose }) {
  const calloutsRemaining = Math.max(0, (activePlan?.callouts || 2) - account.calloutsUsed);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#0286cd]" />
            How Membership Call-Outs Work
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3 text-slate-600">
          <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-1">
            <div className="font-bold text-[#0286cd]">1. Included Call-Outs Allowance</div>
            <p>Your <strong>{activePlan?.name} Plan (${activePlan?.price}/mo)</strong> includes <strong>{activePlan?.callouts} call-out(s) per month</strong>. Each included call-out provides up to 1 hour of emergency cleaning labour at $0 extra charge.</p>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-1">
            <div className="font-bold text-emerald-700">2. Current Balance: {calloutsRemaining} / {activePlan?.callouts} Call-out(s) Remaining</div>
            <p>You have used {account.calloutsUsed} out of your {activePlan?.callouts} included call-out(s) for this monthly billing cycle. Your balance automatically resets in 12 days.</p>
          </div>

          <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-1">
            <div className="font-bold text-amber-800">3. What if all call-outs are used (0 remaining)?</div>
            <p>You can still request emergency cleaning anytime! Additional call-outs incur a <strong>${config.additionalCalloutFee} additional call-out fee</strong> + standard hourly labour rates (${config.overageHourlyRate}/hr).</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl transition-all shadow-md cursor-pointer"
        >
          Got It, Thanks!
        </button>
      </div>
    </div>
  );
}
