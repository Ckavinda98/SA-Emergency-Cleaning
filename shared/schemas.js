// Request body rules, written once with Zod and used by the API (validate middleware).
// The web app can import the same schemas to show errors before sending a form.
import { z } from 'zod';
import { JOB_STATUSES, TECHNICIAN_STATES } from './jobStatus.js';
import { PLAN_IDS } from './config.js';

import { phoneError, emailError, passwordError, personNameError, textError, abnError } from './validation.js';

const text = (min, message) => z.string({ required_error: message, invalid_type_error: message }).trim().min(min, message);

// Wraps a rule from shared/validation.js so the API gives the same message the form shows
const rule = (check, opts) => z.any().superRefine((v, ctx) => {
  const msg = check(v, opts);
  if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
});
// Optional on update: checked only when a value is sent
const optionalRule = (check, opts) => rule((v) => (v === undefined || v === null || v === '' ? '' : check(v, opts)));

export const emailField = () => rule(emailError).transform(v => String(v).trim().toLowerCase());
export const phoneField = () => rule(phoneError);
export const abnField = rule(abnError, { required: true });
export const passwordField = rule(passwordError);

// POST /api/auth/register (public sign-up and admin "register company")
export const registerSchema = z.object({
  businessName: rule(textError, { label: 'Company name' }),
  primaryContactName: rule(personNameError, { label: 'Primary contact name' }),
  phoneNumber: phoneField(),
  email: emailField(),
  password: passwordField
}).passthrough();

// POST /api/customers (admin adds a company)
export const customerCreateSchema = z.object({
  businessName: rule(textError, { label: 'Company name' }),
  abn: abnField,
  primaryContactName: rule(personNameError, { label: 'Primary contact name' }),
  phoneNumber: phoneField(),
  email: emailField()
}).passthrough();

// PUT /api/customers/:id/profile
export const profileSchema = z.object({
  businessName: optionalRule(textError, { label: 'Company name' }),
  primaryContactName: optionalRule(personNameError, { label: 'Primary contact name' }),
  phoneNumber: optionalRule(phoneError),
  abn: optionalRule(abnError),
  email: optionalRule(emailError),
  password: optionalRule(passwordError)
}).passthrough();

// PUT /api/customers/:id/plan
export const planSchema = z.object({
  membershipPlan: z.enum(PLAN_IDS, { errorMap: () => ({ message: 'Unknown membership plan.' }) })
});

// POST /api/customers/:id/locations and PUT /api/locations/:id
export const siteCreateSchema = z.object({
  name: rule(textError, { label: 'Site name' }),
  address: rule(textError, { label: 'Street address', min: 4 }),
  contactName: optionalRule(personNameError, { label: 'Site contact name' }),
  contactPhone: optionalRule(phoneError)
}).passthrough();

// PUT /api/locations/:id: only the fields sent are checked
export const siteUpdateSchema = siteCreateSchema.partial();

// POST /api/jobs
export const jobCreateSchema = z.object({
  description: text(1, 'Please describe what happened.'),
  onsiteContact: rule(personNameError, { label: 'On-site contact name' }),
  onsitePhone: phoneField()
}).passthrough();

// PATCH /api/jobs/:id/status
export const jobStatusSchema = z.object({
  status: z.string().optional().refine(s => s === undefined || JOB_STATUSES.includes(s), s => ({ message: `Unknown status: ${s}` })),
  technicianName: z.string().optional(),
  notes: z.string().optional()
}).passthrough();

// POST /api/technicians
export const technicianCreateSchema = z.object({
  name: rule(personNameError, { label: 'Technician name' }),
  phone: phoneField(),
  email: optionalRule(emailError)
}).passthrough();

// PATCH /api/technicians/:id/status
export const technicianStatusSchema = z.object({
  status: z.enum(TECHNICIAN_STATES, { errorMap: () => ({ message: 'Status must be AVAILABLE, ON_SITE or OFF_DUTY.' }) })
}).passthrough();

// PUT /api/technicians/:id/profile
export const technicianProfileSchema = z.object({
  name: optionalRule(personNameError, { label: 'Name' }),
  phone: optionalRule(phoneError),
  password: optionalRule(passwordError)
}).passthrough();

// POST /api/redemptions
export const redemptionCreateSchema = z.object({
  serviceCode: z.string({ required_error: 'Please choose a service.' })
}).passthrough();

// PATCH /api/redemptions/:id/status
export const redemptionDecisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED'], { errorMap: () => ({ message: 'Status must be APPROVED, REJECTED or CANCELLED.' }) }),
  quoteAmount: z.any().optional(),
  scheduledFor: z.any().optional()
});

// PUT /api/config
export const configSchema = z.object({
  membershipPlans: z.array(z.object({ id: z.string() }).passthrough(), {
    required_error: 'Configuration must include at least one membership plan.',
    invalid_type_error: 'Configuration must include at least one membership plan.'
  }).min(1, 'Configuration must include at least one membership plan.')
}).passthrough();

// PUT /api/technicians/:id (admin edits a technician)
export const technicianUpdateSchema = z.object({
  name: optionalRule(personNameError, { label: 'Technician name' }),
  phone: optionalRule(phoneError)
}).passthrough();
