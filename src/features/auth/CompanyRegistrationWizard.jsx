import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MapPin, AlertTriangle, Award, CheckCircle2, Building, AlertCircle, X, RefreshCw, DollarSign, ChevronRight, FileCheck
} from 'lucide-react';
import { API_BASE } from '@/shared/config/env.js';

/* =========================================================================
   COMPANY REGISTRATION WIZARD (ADELAIDE ONLY), shown as a page at /register and /admin/customers/new
   ========================================================================= */
export const ADELAIDE_LOCATIONS = [
  { suburb: 'Adelaide CBD', postcode: '5000' },
  { suburb: 'North Adelaide', postcode: '5006' },
  { suburb: 'Port Adelaide', postcode: '5015' },
  { suburb: 'Norwood', postcode: '5067' },
  { suburb: 'Unley', postcode: '5061' },
  { suburb: 'Glenelg', postcode: '5045' },
  { suburb: 'Mawson Lakes', postcode: '5095' },
  { suburb: 'Marion', postcode: '5043' },
  { suburb: 'Salisbury', postcode: '5108' },
  { suburb: 'Elizabeth', postcode: '5112' },
  { suburb: 'Prospect', postcode: '5082' },
  { suburb: 'Modbury', postcode: '5092' }
];

export function CompanyRegistrationWizard({ onClose, onRegisterSuccess, isAdminMode = false, config }) {
  // Each step has its own URL (?step=2 …) so Back / Forward and refresh behave like a website.
  // You can only jump to steps you have already reached.
  const [params, setParams] = useSearchParams();
  const [maxStep, setMaxStep] = useState(1);
  const step = Math.min(Math.max(1, Number(params.get('step')) || 1), maxStep);
  const setStep = (n) => { setMaxStep(m => Math.max(m, n)); setParams({ step: String(n) }); window.scrollTo?.(0, 0); document.getElementById('main')?.scrollTo(0, 0); };
  const [businessName, setBusinessName] = useState('');
  const [abn, setAbn] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  
  // Location state (Adelaide restricted)
  const [locationName, setLocationName] = useState('Primary Adelaide Office');
  const [selectedSuburb, setSelectedSuburb] = useState('Adelaide CBD (5000)');
  const [streetAddress, setStreetAddress] = useState('');
  const [locationError, setLocationError] = useState('');

  // T&C State
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Package State
  const [selectedPlan, setSelectedPlan] = useState('business');

  // Payment State
  const [paymentType, setPaymentType] = useState('DIRECT_DEBIT'); // DIRECT_DEBIT or CREDIT_CARD
  const [bsb, setBsb] = useState('105-000');
  const [accountNumber, setAccountNumber] = useState('12345678');
  const [accountName, setAccountName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('');

  // Login password. Public sign-up: the customer chooses it. Admin mode: a random temporary password the admin passes on.
  const [adminPassword, setAdminPassword] = useState(() => {
    if (!isAdminMode) return '';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const rnd = new Uint32Array(10);
    window.crypto.getRandomValues(rnd);
    rnd.forEach(n => { out += chars[n % chars.length]; });
    return `${out}!7`;
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validateAdelaideLocation = () => {
    setLocationError('');
    const fullAddress = `${streetAddress} ${selectedSuburb}`.toLowerCase();
    if (!streetAddress || streetAddress.trim().length < 4) {
      setLocationError('Please enter a valid street address in Adelaide (at least 4 characters).');
      return false;
    }
    if (!fullAddress.includes('adelaide') && !fullAddress.includes('sa') && !fullAddress.includes('5')) {
      setLocationError('Location Error: Emergency Cleaning Membership is strictly restricted exclusively to Adelaide, South Australia locations (Postcodes 5000-5199).');
      return false;
    }
    return true;
  };

  const validateStep1 = () => {
    setSubmitError('');
    if (!businessName || businessName.trim().length < 2) {
      setSubmitError('Validation Error: Business/Company Name is required (at least 2 characters).');
      return false;
    }
    const cleanAbn = abn.replace(/\s/g, '');
    if (!cleanAbn || !/^\d{11}$/.test(cleanAbn)) {
      setSubmitError('Validation Error: Australian Business Number (ABN) must be exactly 11 digits.');
      return false;
    }
    if (!primaryContactName || primaryContactName.trim().length < 2) {
      setSubmitError('Validation Error: Primary Contact Representative Name is required.');
      return false;
    }
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      setSubmitError('Validation Error: Please enter a valid phone number (8 to 12 digits).');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      setSubmitError('Validation Error: Please enter a valid business email address.');
      return false;
    }
    if (!isAdminMode) {
      if (!adminPassword || adminPassword.length < 8) {
        setSubmitError('Validation Error: Password must be at least 8 characters.');
        return false;
      }
      if (adminPassword !== confirmPassword) {
        setSubmitError('Validation Error: The two passwords do not match.');
        return false;
      }
    }
    if (!validateAdelaideLocation()) return false;
    return true;
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!agreedToTerms) {
        setSubmitError('Validation Error: You must review and accept the SACC Service Level Agreement to proceed.');
        return;
      }
      setSubmitError('');
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (isAdminMode) {
        setStep(5); // Admin step for setting company credentials
      } else {
        handleFinalRegister();
      }
    }
  };

  const handleFinalRegister = async () => {
    setSubmitting(true);
    setSubmitError('');

    const fullAddressString = `${streetAddress}, ${selectedSuburb}, SA`;
    const payload = {
      businessName,
      abn: abn || '48 123 456 789',
      primaryContactName,
      phoneNumber,
      email,
      password: adminPassword,
      membershipPlan: selectedPlan,
      paymentType,
      paymentDetails: paymentType === 'CREDIT_CARD' ? { cardNumber, cardExpiry, cardCvc } : { bsb, accountNumber, accountName },
      address: fullAddressString,
      locationName,
      isCreatedByAdmin: isAdminMode
    };

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setSubmitting(false);

      if (res.ok && data.customer) {
        onRegisterSuccess(data.customer, payload);
      } else {
        setSubmitError(data.error || 'Failed to complete registration.');
      }
    } catch (err) {
      setSubmitting(false);
      // No offline fake: the company only exists once the server has saved it
      setSubmitError('Cannot reach the server. Your registration was not saved. Please try again.');
    }
  };

  const steps = [
    { n: 1, label: 'Company & site' },
    { n: 2, label: 'Terms & conditions' },
    { n: 3, label: 'Membership plan' },
    { n: 4, label: 'Payment' },
    ...(isAdminMode ? [{ n: 5, label: 'Login details' }] : [])
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Desktop: vertical step list. Tablet / phone: compact stepper above the form */}
      <aside className="hidden lg:block">
        <ol className="sticky top-4 space-y-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {steps.map(s => (
            <li key={s.n} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${step === s.n ? 'bg-sky-50 text-brand-dark ring-1 ring-sky-200' : step > s.n ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === s.n ? 'bg-brand text-white' : step > s.n ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{step > s.n ? '✓' : s.n}</span>
              {s.label}
            </li>
          ))}
          <li className="px-3 pt-3 text-[11px] text-slate-500">Service covers Adelaide, South Australia (postcodes 5000–5199).</li>
        </ol>
      </aside>
      <div className="min-w-0 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-sm md:p-8">
        <div className="lg:hidden">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Step {step} of {steps.length}</span><span className="text-brand-dark">{steps.find(s => s.n === step)?.label}</span>
          </div>
          <div className="flex gap-1">{steps.map(s => <span key={s.n} className={`h-1.5 flex-1 rounded-full ${s.n <= step ? 'bg-brand' : 'bg-slate-200'}`} />)}</div>
        </div>
        <h2 className="hidden text-lg font-extrabold text-slate-900 lg:block">{steps.find(s => s.n === step)?.label}</h2>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{submitError}</span>
          </div>
        )}

        {/* STEP 1: COMPANY NAME, ADDRESS & ADELAIDE LOCATION */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center gap-2 text-blue-900 font-medium">
              <MapPin className="w-4 h-4 text-[#0286cd] shrink-0" />
              <span>Note: Service coverage is restricted exclusively to <strong>Adelaide, South Australia</strong> commercial locations.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Company / Business Name *</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Adelaide Innovation Tech Hub Pty Ltd"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Australian Business Number (ABN)</label>
                <input
                  type="text"
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="48 123 456 789"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Primary Contact Name *</label>
                <input
                  type="text"
                  required
                  value={primaryContactName}
                  onChange={(e) => setPrimaryContactName(e.target.value)}
                  placeholder="Sarah Jenkins"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0412 345 678"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Company Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com.au"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              {!isAdminMode && (
                <>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Login Password * (at least 8 characters)</label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* ADELAIDE LOCATION SELECTION */}
            <div className="pt-2 border-t border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#0286cd]" />
                Primary Site Location (Adelaide, Australia Only)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Site / Facility Name</label>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Adelaide Headquarters"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Adelaide Suburb & Postcode *</label>
                  <select
                    value={selectedSuburb}
                    onChange={(e) => setSelectedSuburb(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-bold focus:border-[#0286cd] focus:outline-none text-[#0286cd]"
                  >
                    {ADELAIDE_LOCATIONS.map((loc, i) => (
                      <option key={i} value={`${loc.suburb} (${loc.postcode})`}>
                        📍 {loc.suburb}, SA {loc.postcode} (Adelaide)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-slate-700 font-bold mb-1">Street Address in Adelaide *</label>
                <input
                  type="text"
                  required
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. 120 Grenfell Street, Adelaide SA 5000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              {locationError && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{locationError}</span>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <span>Continue to Terms & Conditions</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: TERMS AND CONDITIONS CHECK */}
        {step === 2 && (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#0286cd]" />
              SA Commercial Cleaning Membership Terms & Conditions
            </h4>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 max-h-56 overflow-y-auto text-[11px] text-slate-700 leading-relaxed font-normal">
              <p className="font-bold text-slate-900">1. Coverage & Response Time (SLA)</p>
              <p>SA Commercial Cleaning Services Pty Ltd (SACC) provides emergency cleaning dispatch for registered business accounts located within Adelaide, South Australia. Target attendance is 2 to 4 hours from emergency submission.</p>

              <p className="font-bold text-slate-900">2. Call-out Labor Allowance</p>
              <p>Each included call-out covers initial dispatch and up to 1 hour of emergency cleaning labor. Subsequent labor is billed at standard overage rates ($120/hr).</p>

              <p className="font-bold text-slate-900">3. Plumbing & Drainage Disclaimer</p>
              <p>SACC provides cleaning of affected surfaces only. SACC does not provide plumbing, pipe unblocking, drain clearing, or toilet unclogging services.</p>

              <p className="font-bold text-slate-900">4. Tenure & Cancellation Policy</p>
              <p>Memberships carry a 6-month minimum tenure requirement. Points redemptions unlock after 6 consecutive active months.</p>
            </div>

            <label className="flex items-start gap-3 bg-blue-50 p-4 rounded-xl border border-blue-200 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#0286cd] rounded border-slate-300 focus:ring-[#0286cd]"
              />
              <span className="font-bold text-slate-900 text-xs">
                I have read and agree to the SA Commercial Cleaning Membership Terms & Conditions, 6-month tenure requirement, and emergency callout disclaimers.
              </span>
            </label>

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!agreedToTerms}
                onClick={() => setStep(3)}
                className={`px-6 py-3 rounded-xl font-extrabold flex items-center gap-2 shadow-md cursor-pointer ${
                  agreedToTerms ? 'bg-[#0286cd] hover:bg-[#026fa8] text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Select Membership Package</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PACKAGE SELECTION */}
        {step === 3 && (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#0286cd]" />
              Choose Your Emergency Membership Package
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Essential */}
              <div 
                onClick={() => setSelectedPlan('essential')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-3 relative ${
                  selectedPlan === 'essential' ? 'border-[#0286cd] bg-blue-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">Essential</span>
                  <input type="radio" checked={selectedPlan === 'essential'} onChange={() => setSelectedPlan('essential')} className="text-[#0286cd]" />
                </div>
                <div className="text-2xl font-black text-slate-900">$99 <span className="text-xs text-slate-500 font-normal">/ month</span></div>
                <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 1 Call-out Included / mo</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 2–4 Hr Target Response</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Earn 100 pts / month</li>
                </ul>
              </div>

              {/* Business (Recommended) */}
              <div 
                onClick={() => setSelectedPlan('business')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-3 relative ${
                  selectedPlan === 'business' ? 'border-[#0286cd] bg-blue-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0286cd] text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-sm">
                  MOST POPULAR
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">Business</span>
                  <input type="radio" checked={selectedPlan === 'business'} onChange={() => setSelectedPlan('business')} className="text-[#0286cd]" />
                </div>
                <div className="text-2xl font-black text-slate-900">$199 <span className="text-xs text-slate-500 font-normal">/ month</span></div>
                <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 2 Call-outs Included / mo</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Priority 2–4 Hr Dispatch</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Earn 200 pts / month</li>
                </ul>
              </div>

              {/* Premium */}
              <div 
                onClick={() => setSelectedPlan('premium')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-3 relative ${
                  selectedPlan === 'premium' ? 'border-[#0286cd] bg-blue-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">Premium</span>
                  <input type="radio" checked={selectedPlan === 'premium'} onChange={() => setSelectedPlan('premium')} className="text-[#0286cd]" />
                </div>
                <div className="text-2xl font-black text-slate-900">$399 <span className="text-xs text-slate-500 font-normal">/ month</span></div>
                <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 4 Call-outs Included / mo</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> VIP Rapid Dispatch</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Earn 400 pts / month</li>
                </ul>
              </div>
            </div>

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-3 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <span>Proceed to Payment</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PAYMENT SCREEN (DIRECT DEBIT & CREDIT CARD) */}
        {step === 4 && (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#0286cd]" />
              Select Preferred Payment Method
            </h4>

            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType('DIRECT_DEBIT')}
                className={`p-3.5 rounded-xl border-2 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentType === 'DIRECT_DEBIT'
                    ? 'border-[#0286cd] bg-blue-50 text-[#0286cd] shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building className="w-4 h-4" />
                Direct Debit (PayTo / Bank)
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('CREDIT_CARD')}
                className={`p-3.5 rounded-xl border-2 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentType === 'CREDIT_CARD'
                    ? 'border-[#0286cd] bg-blue-50 text-[#0286cd] shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Credit / Debit Card
              </button>
            </div>

            {/* Direct Debit Form Fields */}
            {paymentType === 'DIRECT_DEBIT' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded border border-emerald-200 uppercase">
                  PayTo Direct Debit Authorization
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">BSB Number</label>
                    <input
                      type="text"
                      value={bsb}
                      onChange={(e) => setBsb(e.target.value)}
                      placeholder="105-000"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="12345678"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={accountName || businessName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Company Account Name..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                  />
                </div>
              </div>
            )}

            {/* Credit Card Form Fields */}
            {paymentType === 'CREDIT_CARD' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[10px] text-blue-700 bg-blue-100 font-bold px-2 py-0.5 rounded border border-blue-200 uppercase">
                  Secure Credit Card Billing
                </span>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4532 •••• •••• 8892"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Expiry Date</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">CVC Code</label>
                    <input
                      type="text"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      placeholder="123"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>

              {isAdminMode ? (
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="px-6 py-3 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <span>Set Credentials (Admin)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleFinalRegister}
                  className="px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>COMPLETE REGISTRATION & ACTIVATE</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: (SYSTEM ADMIN MODE ONLY) CREATE CREDENTIALS */}
        {step === 5 && isAdminMode && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">System Admin Capability</span>
              <h4 className="font-bold text-amber-900 text-xs">Set Initial Login Credentials for {businessName || 'Company'}</h4>
              <p className="text-[11px] text-amber-700">System Admin creates the official login password. The credentials will be assigned to <strong>{email}</strong>.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Company Access Password *</label>
              <input
                type="text"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-mono font-bold"
              />
            </div>

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalRegister}
                className="px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>REGISTER COMPANY & CREATE CREDENTIALS</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
