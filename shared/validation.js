// Field rules shared by every form in the web app and by the API.
// Each check returns '' when the value is fine, or the message to show under the field.
// The API runs the same checks (shared/schemas.js), so a form that passes here also passes there.

const clean = (v) => String(v ?? '').trim();
const phoneDigits = (v) => clean(v).replace(/[\s\-().]/g, '');

export const MESSAGES = {
  required: (label) => `${label} is required.`,
  name: 'Use letters only (spaces, hyphens, apostrophes and full stops are fine).',
  phone: 'Enter an Australian phone number, e.g. 0412 345 678 or 08 8123 4567.',
  email: 'Enter a valid email address, e.g. name@company.com.au.',
  password: 'Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.',
  confirm: 'The passwords do not match.',
  abn: 'An ABN has exactly 11 digits.',
  number: 'Enter a number.'
};

// Australian numbers only: mobiles (04…), landlines (02/03/07/08 + 8 digits), 13/1300/1800 numbers,
// with or without +61. Letters are never allowed.
export function phoneError(value, { required = true } = {}) {
  const raw = clean(value);
  if (!raw) return required ? MESSAGES.required('Phone number') : '';
  if (/[^\d\s\-().+]/.test(raw)) return 'A phone number can only contain digits, spaces and + ( ) -.';
  let d = phoneDigits(raw);
  if (d.startsWith('+61')) d = `0${d.slice(3)}`;
  else if (d.startsWith('61') && d.length === 11) d = `0${d.slice(2)}`;
  if (d.includes('+')) return MESSAGES.phone;
  const ok = /^04\d{8}$/.test(d) // mobile
    || /^0[2378]\d{8}$/.test(d) // landline with area code
    || /^1[38]00\d{6}$/.test(d) // 1300 / 1800
    || /^13\d{4}$/.test(d); // 13 xx xx
  if (!ok) return MESSAGES.phone;
  return '';
}

// Only allows the characters a phone number can contain while typing
export const sanitizePhoneInput = (v) => String(v ?? '').replace(/[^\d\s\-().+]/g, '').slice(0, 18);

export function emailError(value, { required = true } = {}) {
  const v = clean(value);
  if (!v) return required ? MESSAGES.required('Email') : '';
  if (v.length > 254) return MESSAGES.email;
  // name@domain.tld: no spaces, no double dots, a 2+ letter top-level domain
  const ok = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v) && !v.includes('..') && !/^\.|\.@/.test(v);
  return ok ? '' : MESSAGES.email;
}

export function personNameError(value, { required = true, label = 'Name' } = {}) {
  const v = clean(value);
  if (!v) return required ? MESSAGES.required(label) : '';
  if (v.length < 2) return `${label} must be at least 2 characters.`;
  if (v.length > 80) return `${label} must be 80 characters or fewer.`;
  if (!/^[\p{L}][\p{L}\s'’.-]*$/u.test(v)) return MESSAGES.name;
  return '';
}

// Company, site and similar names: must contain at least one letter, numbers are allowed ("7-Eleven", "Unit 4 Office")
export function textError(value, { required = true, label = 'This field', min = 2, max = 120 } = {}) {
  const v = clean(value);
  if (!v) return required ? MESSAGES.required(label) : '';
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} must be ${max} characters or fewer.`;
  if (!/\p{L}/u.test(v)) return `${label} must include letters, not only numbers or symbols.`;
  return '';
}

export function passwordError(value, { required = true } = {}) {
  const v = String(value ?? '');
  if (!v) return required ? MESSAGES.required('Password') : '';
  if (v.length < 8 || !/[a-z]/.test(v) || !/[A-Z]/.test(v) || !/\d/.test(v) || !/[^A-Za-z0-9]/.test(v)) return MESSAGES.password;
  if (v.length > 128) return 'Use 128 characters or fewer.';
  return '';
}

export const confirmPasswordError = (password, confirm) => (!confirm ? MESSAGES.required('Confirm password') : password !== confirm ? MESSAGES.confirm : '');

// What the password still needs, for the live checklist under password fields
export const passwordChecks = (v = '') => [
  { ok: v.length >= 8, label: '8+ characters' },
  { ok: /[A-Z]/.test(v), label: 'Uppercase letter' },
  { ok: /[a-z]/.test(v), label: 'Lowercase letter' },
  { ok: /\d/.test(v), label: 'Number' },
  { ok: /[^A-Za-z0-9]/.test(v), label: 'Symbol' }
];

export function abnError(value, { required = false } = {}) {
  const d = clean(value).replace(/\s/g, '');
  if (!d) return required ? MESSAGES.required('ABN') : '';
  return /^\d{11}$/.test(d) ? '' : MESSAGES.abn;
}

export function numberError(value, { required = true, label = 'This field', min, max } = {}) {
  const v = clean(value);
  if (!v) return required ? MESSAGES.required(label) : '';
  const n = Number(v);
  if (!Number.isFinite(n)) return MESSAGES.number;
  if (min !== undefined && n < min) return `${label} must be at least ${min}.`;
  if (max !== undefined && n > max) return `${label} must be ${max} or less.`;
  return '';
}

// Runs a set of rules: { field: (values) => message } -> { field: message } for the fields that fail
export function validateAll(values, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const msg = rule(values);
    if (msg) errors[field] = msg;
  }
  return errors;
}

/* Payment details (registration) */
export const bsbError = (v) => (/^\d{3}-?\d{3}$/.test(clean(v)) ? '' : 'A BSB is 6 digits, e.g. 105-000.');
export const accountNumberError = (v) => (/^\d{6,10}$/.test(clean(v).replace(/\s/g, '')) ? '' : 'An account number is 6 to 10 digits.');
export function cardNumberError(v) {
  const d = clean(v).replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(d)) return 'A card number is 13 to 19 digits.';
  let sum = 0; // Luhn check catches typos
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0 ? '' : 'This card number is not valid. Please check it.';
}
export function cardExpiryError(v, now = new Date()) {
  const m = clean(v).match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return 'Enter the expiry as MM/YY.';
  const month = Number(m[1]), year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return 'The month must be 01 to 12.';
  const end = new Date(year, month, 1); // first day after the expiry month
  return end > now ? '' : 'This card has expired.';
}
export const cvcError = (v) => (/^\d{3,4}$/.test(clean(v)) ? '' : 'The security code is 3 or 4 digits.');
