import React from 'react';
import {
  X, ChevronRight, Zap
} from 'lucide-react';
import { canOpenHash } from '@shared/roles.js';

/* =========================================================================
   FAST SCREEN JUMPER LEFT-SIDE DRAWER (EXPANDS VIA 3-STRIPE BUTTON)
   ========================================================================= */
export function NavigationSidebarDrawer({ isOpen, onClose, currentHash, navigateTo, currentUser }) {
  if (!isOpen) return null;

  const allRoutes = [
    { hash: '#customer', label: '📊 Customer Dashboard' },
    { hash: '#customer/request', label: '🚨 Request Emergency Cleaning' },
    { hash: '#customer/points', label: '🏆 Reward Points' },
    { hash: '#customer/profile', label: '👤 Profile & Password' },
    { hash: '#customer/cancel', label: '🛑 Cancel Membership' },
    { hash: '#technician', label: '🔧 Technician Dispatch App' },
    { hash: '#admin/dispatch', label: '🛡️ Admin Dispatch Desk' },
    { hash: '#admin/customers', label: '🏢 Customer Directory' },
    { hash: '#admin/register-company', label: '✍️ Admin Register Co.' },
    { hash: '#admin/technicians', label: '👨‍🔧 Technician Roster' },
    { hash: '#admin/points', label: '🎁 Points Approval' },
    { hash: '#admin/reports', label: '📈 Reports & Analytics' },
    { hash: '#admin/hotline', label: '📞 Hotline Phone Request' },
    { hash: '#config', label: '⚙️ Config Studio' }
  ];
  // Only list the screens this user's role is allowed to open
  const routes = allRoutes.filter(r => canOpenHash(currentUser?.role, r.hash));

  return (
    <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-200">
      {/* Click outside backdrop to close */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={onClose}
        aria-label="Close navigation sidebar"
      />

      {/* Top to Bottom Left Side Drawer */}
      <div className="relative w-80 max-w-[85vw] bg-slate-900 text-white h-full shadow-2xl flex flex-col z-10 border-r border-slate-800 animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#0286cd] p-2 rounded-xl text-white shadow-md shadow-[#0286cd]/30">
              <Zap className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-white">
                Screen Jumper
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">Quick switch screens & modules</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info banner if logged in */}
        {currentUser && (
          <div className="p-3 mx-3 mt-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0286cd] text-white flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-sm">
              {currentUser.name ? currentUser.name.charAt(0) : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-[#0286cd]/20 text-[#0286cd] border border-[#0286cd]/40">
                  {currentUser.role}
                </span>
                {currentUser.businessName && (
                  <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                    {currentUser.businessName}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Route List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scroll-container">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-2 py-1">
            Available Screens
          </div>
          {routes.map(r => {
            const isActive = currentHash === r.hash || (r.hash === '#customer' && (!currentHash || currentHash === '' || currentHash === '#'));
            return (
              <button
                key={r.hash}
                onClick={() => {
                  navigateTo(r.hash);
                  onClose();
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-between transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0286cd] text-white shadow-md shadow-[#0286cd]/30 font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="truncate">{r.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-white shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="font-semibold text-slate-300">SA Emergency Cleaning</span>
          <span className="text-[10px] font-mono text-slate-500">24/7 Response</span>
        </div>
      </div>
    </div>
  );
}
