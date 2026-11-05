import React from 'react';
import {
  Award, X
} from 'lucide-react';

/* =========================================================================
   POINTS REDEMPTION MODAL
   ========================================================================= */
export function PointsRedemptionModal({ account, config, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-700" />
            Reward Points Catalog & Redemption Form
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2">
          <p className="text-slate-700 font-medium">Your Current Balance: <span className="font-bold text-purple-700">{account.pointsBalance} pts</span></p>
          <div className="space-y-2 pt-2">
            {(config.redemptionRates || []).slice(0, 5).map(rate => (
              <div key={rate.code} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-800 font-bold">{rate.name}</span>
                <span className="text-purple-700 font-bold">{rate.points} pts / {rate.unit}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow">
          Close Catalog
        </button>
      </div>
    </div>
  );
}
