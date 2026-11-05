import React from 'react';
import {
  X, ChevronRight, Zap
} from 'lucide-react';
import { canOpenHash } from '@shared/roles.js';

/* =========================================================================
   ATTACHED SIDEBAR: SLIDES WITHIN THE SCREEN (WHITE / LIGHT THEME MATCHING MAIN SCREEN)
   ========================================================================= */
export function NavigationSidebarDrawer({ isOpen, onClose, currentHash, navigateTo, currentUser }) {
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
    <aside
      aria-label="Navigation Sidebar"
      className={`shrink-0 bg-white text-slate-800 border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col z-30 h-full ${
        isOpen 
          ? 'w-72 sm:w-80 opacity-100 shadow-lg' 
          : 'w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none'
      }`}
    >
      {/* Inner fixed-width container to prevent text/layout squishing during slide */}
      <div className="w-72 sm:w-80 h-full flex flex-col overflow-hidden">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#0286cd] p-2 rounded-xl text-white shadow-md shadow-[#0286cd]/25">
              <Zap className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Screen Jumper
              </h2>
              <p className="text-[10px] text-slate-500 font-medium">Quick switch screens & modules</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Collapse sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info banner if logged in */}
        {currentUser && (
          <div className="p-3 mx-3 mt-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#0286cd] text-white flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-sm">
              {currentUser.name ? currentUser.name.charAt(0) : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-[#0286cd]/10 text-[#0286cd] border border-[#0286cd]/30">
                  {currentUser.role}
                </span>
                {currentUser.businessName && (
                  <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
                    {currentUser.businessName}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Route List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 custom-scroll-container">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 py-1">
            Available Screens
          </div>
          {routes.map(r => {
            const isActive = currentHash === r.hash || (r.hash === '#customer' && (!currentHash || currentHash === '' || currentHash === '#'));
            return (
              <button
                key={r.hash}
                onClick={() => {
                  navigateTo(r.hash);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-between transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0286cd] text-white shadow-md shadow-[#0286cd]/25 font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="truncate">{r.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-white shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/80 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
          <span className="font-semibold text-slate-700">SA Emergency Cleaning</span>
          <span className="text-[10px] font-mono text-slate-400">24/7 Response</span>
        </div>
      </div>
    </aside>
  );
}
