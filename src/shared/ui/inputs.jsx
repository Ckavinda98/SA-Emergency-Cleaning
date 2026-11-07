// Inputs with built-in rules, shared by every form: phone, password (with a live checklist) and
// address search. They only shape what can be typed; the messages come from shared/validation.js.
import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Check, X, MapPin, Loader2 } from 'lucide-react';
import { sanitizePhoneInput, passwordChecks } from '@shared/validation.js';
import { GOOGLE_MAPS_API_KEY } from '@/shared/config/env.js';
import { inputCls, cx } from './index.jsx';

// Letters can't be typed into a phone field
export const PhoneInput = React.forwardRef(function PhoneInput({ value, onChange, className, ...rest }, ref) {
  return (
    <input ref={ref} type="tel" inputMode="tel" autoComplete="tel" maxLength={18} placeholder="0412 345 678"
      className={cx(inputCls, className)} value={value} onChange={e => onChange(sanitizePhoneInput(e.target.value))} {...rest} />
  );
});

export function PasswordInput({ value, onChange, showChecklist = false, className, autoComplete = 'new-password', ...rest }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <div className="relative">
        <input type={shown ? 'text' : 'password'} autoComplete={autoComplete} className={cx(inputCls, 'pr-11', className)}
          value={value} onChange={e => onChange(e.target.value)} {...rest} />
        <button type="button" onClick={() => setShown(s => !s)} title={shown ? 'Hide password' : 'Show password'} aria-label={shown ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer">
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showChecklist && value && (
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {passwordChecks(value).map(c => (
            <li key={c.label} className={cx('flex items-center gap-1 text-[11px] font-semibold', c.ok ? 'text-emerald-600' : 'text-slate-400')}>
              {c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Address search (Google Places) */

let placesPromise = null;
function loadPlaces() {
  if (!GOOGLE_MAPS_API_KEY) return Promise.resolve(null);
  if (window.google?.maps?.importLibrary) return window.google.maps.importLibrary('places');
  if (!placesPromise) {
    placesPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&loading=async&v=weekly&libraries=places`;
      s.async = true;
      s.onload = () => window.google.maps.importLibrary('places').then(resolve, reject);
      s.onerror = () => { placesPromise = null; reject(new Error('Google Maps did not load')); };
      document.head.appendChild(s);
    });
  }
  return placesPromise;
}

// Results are kept to greater Adelaide, which is the service area
const ADELAIDE_BOUNDS = { north: -34.45, south: -35.45, east: 139.05, west: 138.35 };

const part = (components, type, short = false) => {
  const c = (components || []).find(x => x.types.includes(type));
  return c ? (short ? c.shortText : c.longText) : '';
};

// Type an address and pick a suggestion. onSelect gets { address, street, suburb, postcode, state, lat, lng }.
// Without VITE_GOOGLE_MAPS_API_KEY it is a normal text box.
export function AddressAutocomplete({ value, onChange, onSelect, placeholder = 'Start typing the street address', className, ...rest }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [unavailable, setUnavailable] = useState(!GOOGLE_MAPS_API_KEY);
  const token = useRef(null);
  const box = useRef(null);
  const skipNext = useRef(false);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (unavailable) return undefined;
    if (skipNext.current) { skipNext.current = false; return undefined; }
    const q = String(value || '').trim();
    if (q.length < 3) { setSuggestions([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const places = await loadPlaces();
        if (!places || cancelled) return;
        token.current = token.current || new places.AutocompleteSessionToken();
        const { suggestions: found } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q, sessionToken: token.current, includedRegionCodes: ['au'], locationRestriction: ADELAIDE_BOUNDS
        });
        if (!cancelled) { setSuggestions((found || []).filter(s => s.placePrediction).slice(0, 6)); setActive(0); setOpen(true); }
      } catch {
        if (!cancelled) setUnavailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [value, unavailable]);

  const pick = async (s) => {
    setOpen(false);
    const p = s.placePrediction;
    try {
      const place = p.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'addressComponents', 'location'] });
      token.current = null; // a session ends when a place is chosen
      const c = place.addressComponents;
      const street = [part(c, 'subpremise'), [part(c, 'street_number'), part(c, 'route')].filter(Boolean).join(' ')].filter(Boolean).join('/');
      const result = {
        address: place.formattedAddress, street: street || p.mainText?.toString() || '',
        suburb: part(c, 'locality'), postcode: part(c, 'postal_code'), state: part(c, 'administrative_area_level_1', true),
        lat: place.location?.lat?.(), lng: place.location?.lng?.()
      };
      skipNext.current = true;
      onChange(result.street || result.address);
      onSelect?.(result);
    } catch {
      skipNext.current = true;
      onChange(p.text.toString());
    }
  };

  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" autoComplete="off" role="combobox" aria-expanded={open} aria-autocomplete="list"
          className={cx(inputCls, 'pl-9', className)} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)} onFocus={() => suggestions.length && setOpen(true)} onKeyDown={onKeyDown} {...rest} />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg" role="listbox">
          {suggestions.map((s, i) => (
            <li key={s.placePrediction.placeId} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(s)}
                className={cx('flex w-full items-start gap-2 px-3 py-2 text-left text-sm cursor-pointer', i === active ? 'bg-sky-50' : 'hover:bg-slate-50')}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">{s.placePrediction.mainText?.toString() || s.placePrediction.text.toString()}</span>
                  <span className="block truncate text-xs text-slate-500">{s.placePrediction.secondaryText?.toString()}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="px-3 py-1 text-right text-[10px] text-slate-400">Suggestions by Google</li>
        </ul>
      )}
    </div>
  );
}
