import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MapPin, Award, CheckCircle2, Building, AlertCircle, X, RefreshCw, DollarSign, ChevronRight, FileCheck
} from 'lucide-react';
import { API_BASE } from '@/shared/config/env.js';
import { Field, inputCls, useFieldErrors } from '@/shared/ui/index.jsx';
import { PhoneInput, PasswordInput, AddressAutocomplete } from '@/shared/ui/inputs.jsx';
import { phoneError, emailError, passwordError, confirmPasswordError, personNameError, textError, abnError, bsbError, accountNumberError } from '@shared/validation.js';
import { serviceArea, COMPANY, money } from '@shared/membership.js';
import { PlanCards } from '@/shared/ui/membership.jsx';

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
  const [referralCode, setReferralCode] = useState('');
  const [billingFrequency, setBillingFrequency] = useState('MONTHLY');
  const [streetAddress, setStreetAddress] = useState('');
  const [locationError, setLocationError] = useState('');

  // T&C State
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Package State
  const [selectedPlan, setSelectedPlan] = useState('business');

  // Payment State
  const [paymentType, setPaymentType] = useState('DIRECT_DEBIT'); // DIRECT_DEBIT or CARD (secure payment link)
  const [bsb, setBsb] = useState('105-000');
  const [accountNumber, setAccountNumber] = useState('12345678');
  const [accountName, setAccountName] = useState('');

  // Login password. Public sign-up: the customer chooses it. Admin mode: a random temporary password the admin passes on.
  const [adminPassword, setAdminPassword] = useState(() => {
    if (!isAdminMode) return '';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const rnd = new Uint32Array(10);
    window.crypto.getRandomValues(rnd);
    rnd.forEach(n => { out += chars[n % chars.length]; });
    return `${out}Ak7!`; // always has upper, lower, number and symbol
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const { errors, check, clear, set: setFieldError } = useFieldErrors();
  // Wraps a setter so editing a field clears its message
  const edit = (setter, field) => (v) => { setter(v); clear(field); };

  // Any South Australian postcode can apply: metro Adelaide is covered, other SA sites are accepted at SACC's discretion (cl. 18)
  const inServiceArea = (postcode) => { const n = Number(postcode); return n >= 5000 && n <= 5999; };
  const area = serviceArea(`${streetAddress}, ${selectedSuburb.replace(/ \((\d+)\)$/, ' SA $1')}`, config);

  // A picked Google suggestion fills the street and the suburb / postcode
  const onAddressPicked = (a) => {
    if (a.postcode && !inServiceArea(a.postcode)) {
      setFieldError('streetAddress', `${a.suburb || 'This address'} ${a.postcode} is outside South Australia. SACC services SA sites only.`);
      return;
    }
    if (a.suburb && a.postcode) setSelectedSuburb(`${a.suburb} (${a.postcode})`);
    clear('streetAddress');
  };

  const validateStep1 = () => {
    setSubmitError('');
    setLocationError('');
    const values = { businessName, abn, primaryContactName, phoneNumber, email, adminPassword, confirmPassword, locationName, streetAddress };
    return check({
      businessName: v => textError(v.businessName, { label: 'Company name' }),
      abn: v => abnError(v.abn, { required: true }),
      primaryContactName: v => personNameError(v.primaryContactName, { label: 'Contact name' }),
      phoneNumber: v => phoneError(v.phoneNumber),
      email: v => emailError(v.email),
      ...(isAdminMode ? {} : {
        adminPassword: v => passwordError(v.adminPassword),
        confirmPassword: v => confirmPasswordError(v.adminPassword, v.confirmPassword)
      }),
      locationName: v => textError(v.locationName, { label: 'Site name', required: false }),
      streetAddress: v => (String(v.streetAddress).trim().length < 4 ? 'Enter the street address, e.g. 120 Grenfell Street.' : /\p{L}/u.test(v.streetAddress) ? '' : 'The street address must include the street name.')
    }, values);
  };

  // Payment details: bank fields for direct debit. Card numbers are never typed into this app:
  // card payments go through the payment provider's secure page.
  const validatePayment = () => check(paymentType === 'CARD' ? {} : {
    bsb: v => bsbError(v.bsb),
    accountNumber: v => accountNumberError(v.accountNumber),
    accountName: v => textError(v.accountName, { label: 'Account holder name' })
  }, { bsb, accountNumber, accountName: accountName || businessName });

  const validateCredentials = () => check({ adminPassword: v => passwordError(v.adminPassword) }, { adminPassword });

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
      if (!validatePayment()) return;
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

    const fullAddressString = `${streetAddress}, ${selectedSuburb.replace(/ \((\d+)\)$/, ' SA $1')}`;
    const payload = {
      businessName,
      abn: abn.replace(/\s/g, ''),
      primaryContactName,
      phoneNumber,
      email,
      password: adminPassword,
      membershipPlan: selectedPlan,
      billingFrequency,
      referralCode: referralCode.trim() || undefined,
      paymentType,
      paymentDetails: paymentType === 'CARD' ? undefined : { bsb, accountNumber, accountName },
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
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-8">
      {/* Desktop: vertical step list. Tablet / phone: compact stepper above the form */}
      <aside className="hidden lg:block">
        <ol className="sticky top-4 space-y-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {steps.map(s => (
            <li key={s.n} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${step === s.n ? 'bg-sky-50 text-brand-dark ring-1 ring-sky-200' : step > s.n ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === s.n ? 'bg-brand text-white' : step > s.n ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{step > s.n ? '✓' : s.n}</span>
              {s.label}
            </li>
          ))}
          <li className="px-3 pt-3 text-[11px] text-slate-500">Covers the Adelaide metro area. Other South Australian sites can be accepted with a travel charge. 24/7 hotline {COMPANY.hotline}.</li>
        </ol>
      </aside>
      <div className="min-w-0 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-sm md:p-8 xl:space-y-4 xl:px-8 xl:py-6">
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
          <form onSubmit={handleNextStep} noValidate className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center gap-2 text-blue-900 font-medium">
              <MapPin className="w-4 h-4 text-[#0286cd] shrink-0" />
              <span>Membership covers commercial sites in the <strong>Adelaide metro area</strong>. Sites elsewhere in South Australia can be accepted at SACC's discretion, with travel at {money(config?.travelRatePerKm ?? 1.5)}/km each way.</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Company / business name" required error={errors.businessName} className="xl:col-span-2">
                <input className={inputCls} value={businessName} onChange={e => edit(setBusinessName, 'businessName')(e.target.value)} placeholder="e.g. Adelaide Innovation Tech Hub Pty Ltd" autoComplete="organization" />
              </Field>
              <Field label="Australian Business Number (ABN)" required error={errors.abn} hint="11 digits">
                <input className={inputCls} value={abn} inputMode="numeric" maxLength={14} onChange={e => edit(setAbn, 'abn')(e.target.value.replace(/[^\d\s]/g, ''))} placeholder="48 123 456 789" />
              </Field>
              <Field label="Primary contact name" required error={errors.primaryContactName}>
                <input className={inputCls} value={primaryContactName} onChange={e => edit(setPrimaryContactName, 'primaryContactName')(e.target.value)} placeholder="Sarah Jenkins" autoComplete="name" />
              </Field>
              <Field label="Phone number" required error={errors.phoneNumber} hint="Mobile or landline, e.g. 0412 345 678">
                <PhoneInput value={phoneNumber} onChange={edit(setPhoneNumber, 'phoneNumber')} aria-invalid={Boolean(errors.phoneNumber)} className={errors.phoneNumber ? '!border-red-400 !bg-red-50/40' : ''} />
              </Field>
              <Field label="Company email" required error={errors.email}>
                <input type="email" className={inputCls} value={email} onChange={e => edit(setEmail, 'email')(e.target.value)} placeholder="contact@company.com.au" autoComplete="email" />
              </Field>
              {!isAdminMode && (
                <>
                  <Field as="div" label="Login password" required error={errors.adminPassword}>
                    <PasswordInput value={adminPassword} onChange={edit(setAdminPassword, 'adminPassword')} showChecklist aria-invalid={Boolean(errors.adminPassword)} className={errors.adminPassword ? '!border-red-400 !bg-red-50/40' : ''} />
                  </Field>
                  <Field as="div" label="Confirm password" required error={errors.confirmPassword}>
                    <PasswordInput value={confirmPassword} onChange={edit(setConfirmPassword, 'confirmPassword')} aria-invalid={Boolean(errors.confirmPassword)} className={errors.confirmPassword ? '!border-red-400 !bg-red-50/40' : ''} />
                  </Field>
                </>
              )}
            </div>

            {/* ADELAIDE LOCATION */}
            <div className="border-t border-slate-200 pt-2">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <MapPin className="h-4 w-4 text-[#0286cd]" />
                Primary site location
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Site / facility name" error={errors.locationName}>
                  <input className={inputCls} value={locationName} onChange={e => edit(setLocationName, 'locationName')(e.target.value)} placeholder="Adelaide Headquarters" />
                </Field>
                <Field label="Suburb and postcode" required hint="Filled in when you pick an address below">
                  <select value={selectedSuburb} onChange={e => setSelectedSuburb(e.target.value)} className={inputCls}>
                    {[...ADELAIDE_LOCATIONS.map(l => `${l.suburb} (${l.postcode})`), ...(ADELAIDE_LOCATIONS.some(l => `${l.suburb} (${l.postcode})` === selectedSuburb) ? [] : [selectedSuburb])].map(v => (
                      <option key={v} value={v}>📍 {v.replace(/ \((\d+)\)$/, ', SA $1')}</option>
                    ))}
                  </select>
                </Field>
                <Field as="div" label="Street address" required error={errors.streetAddress || locationError} className="md:col-span-2"
                  hint="Start typing and pick your address from the list">
                  <AddressAutocomplete value={streetAddress} onChange={edit(setStreetAddress, 'streetAddress')} onSelect={onAddressPicked}
                    placeholder="e.g. 120 Grenfell Street" aria-invalid={Boolean(errors.streetAddress)} className={errors.streetAddress ? '!border-red-400 !bg-red-50/40' : ''} />
                </Field>
              </div>
              {streetAddress.trim().length > 3 && area === 'OUTSIDE_METRO' && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  This site is outside the Adelaide metro area. SACC will confirm whether it can accept it. Visits there have a travel charge of {money(config?.travelRatePerKm ?? 1.5)}/km each way from the Adelaide GPO, and the 2–4 hour response target does not apply.
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-4">
              {!isAdminMode ? (
                <Field label="Referral code (optional)" className="w-full max-w-xs" hint="From a business that referred you">
                  <input className={inputCls} value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())} placeholder="REF-XXXXXX" />
                </Field>
              ) : <span />}
              <div className="ml-auto flex gap-3 sm:mb-5">
              <button
                type="button"
                title="Leave registration without saving"
                onClick={onClose}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                title="Check these details and go to the next step"
                className="px-6 py-3 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <span>Continue to Terms & Conditions</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
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

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 max-h-72 overflow-y-auto text-[11px] text-slate-700 leading-relaxed font-normal">
              <p className="text-slate-500">Summary of the Membership Agreement & Terms v1.0 of {COMPANY.legalName} (ACN {COMPANY.acn}). All prices exclude GST.</p>
              <p className="font-bold text-slate-900">1. Term and billing</p>
              <p>Membership runs for 12 months from the Activation Date (your first payment) and renews automatically for further 12-month periods. Fees are billed in advance, monthly or annually. Extra charges are invoiced after each visit and are due within 7 days. If a payment is unpaid 7 days after notice, benefits are suspended until it is paid.</p>
              <p className="font-bold text-slate-900">2. Waiting period</p>
              <p>Included call-outs can be used from day 11. During the first 10 days SACC attends where possible and a one-off {money(config?.earlyActivationFee ?? 100)} early activation fee applies.</p>
              <p className="font-bold text-slate-900">3. Call-outs and labour</p>
              <p>Each included call-out covers one visit and the first hour of one technician. Call-outs reset on the 1st of each month and do not roll over. When they are used up you can still request help: each extra call-out is {money(config?.additionalCalloutFee ?? 30)} plus labour after the first hour at your plan's rate (Essential $95/hr, Business $90/hr, Premium $85/hr), billed in whole hours per technician.</p>
              <p className="font-bold text-slate-900">4. Service windows and surcharges</p>
              <p>Essential covers 6:00 am to 9:00 pm, 7 days; Business and Premium cover 24/7. A {money(config?.surchargeAmount ?? 50)} surcharge applies after hours (Business, or Essential at SACC's discretion) and on public holidays (Essential and Business); only one surcharge per visit. Premium has no surcharges.</p>
              <p className="font-bold text-slate-900">5. Response time and priority</p>
              <p>SACC aims to attend within 2 to 4 hours of acknowledging a valid request, counted inside your plan's service window. Dispatch priority is Premium, then Business, then Essential. If SACC arrives more than 4 hours late for reasons within its control, you receive 50 reward points.</p>
              <p className="font-bold text-slate-900">6. What is covered</p>
              <p>Spills, vomit/urine/faeces, toilet overflow (cleaning only: no plumbing, drain clearing or unclogging), burst pipes and wet carpet up to about 10 m² of clean water, slip hazards, carpet spots, broken glass, minor graffiti up to 2 m², kitchen or bathroom clean-ups and bin leakage. Bigger or specialist jobs (grey or black water, mould, biohazard and more) are quoted separately and do not use a call-out. Special disposal is charged at cost plus {money(config?.disposalHandlingFee ?? 25)}.</p>
              <p className="font-bold text-slate-900">7. Access and cancellations</p>
              <p>A responsible person must be on site. If the technician cannot get in, or you cancel after a technician is dispatched, the call-out is used and a $100 fee applies. Cancelling before dispatch is free.</p>
              <p className="font-bold text-slate-900">8. Rewards</p>
              <p>Earn 1 point per $1 of membership fees and 30 points for each unused call-out. 1 point = $1 off periodical services. Points can be used after 6 consecutive months and expire 12 months after they are earned. Referrals earn 100 points.</p>
              <p className="font-bold text-slate-900">9. Plan changes and cancellation</p>
              <p>Upgrades apply immediately (fee difference charged pro-rata); downgrades start from the next billing period. You can cancel at any time once 30 days have passed since your last call-out; prepaid fees are refunded pro-rata and all reward points are cancelled.</p>
              <p className="font-bold text-slate-900">10. Insurance</p>
              <p>SACC holds {COMPANY.publicLiability} public liability insurance. SACC does not prepare insurance reports or deal with insurers.</p>
            </div>

            <label className="flex items-start gap-3 bg-blue-50 p-4 rounded-xl border border-blue-200 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#0286cd] rounded border-slate-300 focus:ring-[#0286cd]"
              />
              <span className="font-bold text-slate-900 text-xs">
                I have read and agree to the {COMPANY.legalName} Membership Agreement & Terms, including the 12-month term, the 10-day waiting period and the call-out rules.
              </span>
            </label>

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                title="Go back to the company details"
                onClick={() => setStep(1)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                title="Accept the service agreement and choose a plan"
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

            <PlanCards plans={config?.membershipPlans || []} config={config} selected={selectedPlan} onSelect={setSelectedPlan} />
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-2 text-xs font-bold text-slate-900">How would you like to be billed?</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[['MONTHLY', 'Monthly', 'Billed on the same day each month'], ['ANNUAL', 'Annually', 'Billed once a year on your activation date']].map(([id, label, hint]) => (
                  <label key={id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${billingFrequency === id ? 'border-[#0286cd] bg-blue-50' : 'border-slate-200'}`}>
                    <input type="radio" name="billing" checked={billingFrequency === id} onChange={() => setBillingFrequency(id)} className="mt-0.5" />
                    <span><span className="block text-sm font-bold text-slate-900">{label}</span><span className="text-xs text-slate-500">{hint}</span></span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Adding more sites later? Membership fees are 10% off for 2–5 sites and 15% off for 6–10 sites.</p>
            </div>

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                title="Go back to the service agreement"
                onClick={() => setStep(2)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                title="Use this plan and go to payment"
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
                title="Pay each month from a bank account"
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
                title="Pay each month by credit or debit card"
                onClick={() => setPaymentType('CARD')}
                className={`p-3.5 rounded-xl border-2 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentType === 'CARD'
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
                  <Field label="BSB number" required error={errors.bsb}>
                    <input type="text" inputMode="numeric" maxLength={7} value={bsb} placeholder="105-000"
                      onChange={(e) => edit(setBsb, 'bsb')(e.target.value.replace(/[^\d-]/g, ''))}
                      className={`${inputCls} font-mono font-bold`} />
                  </Field>
                  <Field label="Account number" required error={errors.accountNumber}>
                    <input type="text" inputMode="numeric" maxLength={10} value={accountNumber} placeholder="12345678"
                      onChange={(e) => edit(setAccountNumber, 'accountNumber')(e.target.value.replace(/[^\d]/g, ''))}
                      className={`${inputCls} font-mono font-bold`} />
                  </Field>
                </div>
                <Field label="Account holder name" required error={errors.accountName}>
                  <input type="text" value={accountName || businessName} placeholder="Company account name"
                    onChange={(e) => edit(setAccountName, 'accountName')(e.target.value)} className={inputCls} />
                </Field>
              </div>
            )}

            {/* Card: no card numbers in this app (PCI DSS). SACC sends a secure payment link from its payment provider. */}
            {paymentType === 'CARD' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs text-slate-700">
                <span className="text-[10px] text-blue-700 bg-blue-100 font-bold px-2 py-0.5 rounded border border-blue-200 uppercase">Secure card payment</span>
                <p>For your security, card details are not entered in this app. After you register, SACC sends a secure payment link from its payment provider to {email || 'your company email'} to add your card.</p>
              </div>
            )}

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                title="Go back to the plans"
                onClick={() => setStep(3)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>

              {isAdminMode ? (
                <button
                  type="button"
                  title="Check the payment details, then set the company's login password"
                  onClick={() => { if (validatePayment()) setStep(5); }}
                  className="px-6 py-3 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <span>Set Credentials (Admin)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  title="Check the payment details and create your account"
                  onClick={() => { if (validatePayment()) handleFinalRegister(); }}
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

            <Field label="Company access password" required error={errors.adminPassword} as="div">
              <PasswordInput value={adminPassword} onChange={edit(setAdminPassword, 'adminPassword')} showChecklist />
            </Field>

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                title="Go back to payment"
                onClick={() => setStep(4)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting}
                title="Create the company account with this login password"
                onClick={() => { if (validateCredentials()) handleFinalRegister(); }}
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
