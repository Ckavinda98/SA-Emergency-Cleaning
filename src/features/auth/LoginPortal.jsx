import React, { useState } from 'react';
import {
  User, Building, ArrowRight, AlertCircle, Shield, RefreshCw
} from 'lucide-react';
import { API_BASE, IS_DEV } from '@/shared/config/env.js';

/* =========================================================================
   LOGIN PORTAL COMPONENT (CLEAN SINGLE-CARD AUTO-ROLE AUTHENTICATION)
   ========================================================================= */
export function LoginPortal({ onLogin, dbStatus, customerAccounts, onOpenRegister }) {
  // Demo shortcuts exist only in `npm run dev`. A production build never shows or prefills credentials.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDemoRole, setSelectedDemoRole] = useState(null);
  const [showDevBar, setShowDevBar] = useState(IS_DEV);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok && data.user) {
        onLogin(data.user, data.accessToken, data.refreshToken);
      } else {
        setErrorMsg(data.error || 'Invalid credentials.');
      }
    } catch (err) {
      setLoading(false);
      // No offline or mock login: the server must confirm the email and password against the database
      setErrorMsg('Cannot reach the server. Check that the API is running and try again.');
    }
  };

  return (
    <div className="min-h-screen text-slate-800 flex flex-col justify-between p-4 lg:p-8 login-card-gradient">
      {/* Top Header - Aligned with the max-w-md login panel */}
      <header className="max-w-md w-full mx-auto py-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#e4e4e4] p-2 rounded-xl shadow-sm border border-slate-300 flex items-center justify-center shrink-0">
            <img src="/logo.webp" alt="SA Commercial Cleaning Logo" className="h-9 w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
              SA Emergency Cleaning
            </h1>
            <p className="text-[11px] text-[#0286cd] font-semibold leading-tight">
              Emergency Cleaning Membership Portal • South Australia
            </p>
          </div>
        </div>
      </header>

      {/* Main Centered Login Card */}
      <main className="max-w-md w-full mx-auto my-auto py-6">
        <div className="bg-white p-8 rounded-3xl space-y-6 border border-slate-200 shadow-xl shadow-slate-300/40">
          {/* Logo Showcase at Top of Form with #e4e4e4 background */}
          <div className="text-center">
            <div className="p-3.5 rounded-2xl bg-[#e4e4e4] inline-block shadow-sm border border-slate-300">
              <img src="/logo.webp" alt="SA Commercial Cleaning Services Logo" className="h-16 w-auto mx-auto object-contain" />
            </div>
          </div>

          {/* Development Quick Demo Login Bar with Toggle (npm run dev only) */}
          {IS_DEV && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                {showDevBar ? '🛠️ Dev Demo Login:' : 'Quick Login'}
              </span>
              <button
                type="button"
                onClick={() => setShowDevBar(!showDevBar)}
                className="text-[10px] font-bold text-slate-400 hover:text-[#0286cd] transition-colors cursor-pointer flex items-center gap-1"
                title={showDevBar ? "Hide Demo Bar (Normal User Mode)" : "Show Dev Demo Bar"}
              >
                <span>{showDevBar ? 'Hide Dev Bar ✕' : '🛠️ Show Demo Accounts'}</span>
              </button>
            </div>

            {showDevBar && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-center transition-all animate-in fade-in duration-150">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('mahima@mahimaenterprises.com.au');
                      setPassword('Password123!');
                      setSelectedDemoRole('customer');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] transition-all cursor-pointer border ${
                      selectedDemoRole === 'customer'
                        ? 'bg-[#0286cd] text-white font-extrabold shadow-sm border-[#0286cd] ring-2 ring-[#0286cd]/30'
                        : 'bg-white hover:bg-blue-50 border-blue-200 text-[#0286cd] font-bold'
                    }`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('dave@sacleaning.com.au');
                      setPassword('Password123!');
                      setSelectedDemoRole('technician');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] transition-all cursor-pointer border ${
                      selectedDemoRole === 'technician'
                        ? 'bg-amber-600 text-white font-extrabold shadow-sm border-amber-600 ring-2 ring-amber-500/30'
                        : 'bg-white hover:bg-amber-50 border-amber-200 text-amber-700 font-bold'
                    }`}
                  >
                    Tech
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@sacleaning.com.au');
                      setPassword('Password123!');
                      setSelectedDemoRole('admin');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] transition-all cursor-pointer border ${
                      selectedDemoRole === 'admin'
                        ? 'bg-purple-600 text-white font-extrabold shadow-sm border-purple-600 ring-2 ring-purple-500/30'
                        : 'bg-white hover:bg-purple-50 border-purple-200 text-purple-700 font-bold'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Email / Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#0286cd] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@business.com.au"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-medium transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Password</label>
              <div className="relative">
                <Shield className="w-4 h-4 text-[#0286cd] absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-medium transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-300 bg-slate-50 text-[#0286cd] focus:ring-0" />
                <span>Remember session</span>
              </label>
              <a href="#forgot" onClick={(e) => e.preventDefault()} className="text-[#0286cd] hover:underline font-semibold">Forgot password?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#0286cd]/20 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Sign In</span>
            </button>

            <div className="pt-4 border-t border-slate-200 text-center space-y-2">
              <p className="text-[11px] text-slate-500 font-semibold">New Adelaide business customer?</p>
              <button
                type="button"
                onClick={onOpenRegister}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Building className="w-4 h-4" />
                <span>Register New Business Account</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer - Aligned with max-w-md login panel */}
      <footer className="max-w-md w-full mx-auto py-4 text-center text-xs text-slate-500 border-t border-slate-200">
        <p>© 2026 SA Commercial Cleaning Services Pty Ltd (SACC). All rights reserved.</p>
      </footer>
    </div>
  );
}
