// Request body rules, written once with Zod and used by the API (validate middleware).
// The web app can import the same schemas to show errors before sending a form.
import { z } from 'zod';
import { JOB_STATUSES, TECHNICIAN_STATES } from './jobStatus.js';
import { PLAN_IDS } from './config.js';

const digits = (value) => String(value || '').replace(/[\s\-()+]/g, '');
const text = (min, message) => z.string({ required_error: message, invalid_type_error: message }).trim().min(min, message);

export const emailField = (message = 'Please enter a valid email address.') =>
  z.string({ required_error: message }).trim().toLowerCase().email(message);

export const phoneField = (message = 'Please enter a valid phone number (8 to 12 digits).') =>
  z.string({ required_error: message }).refine(v => /^\d{8,12}$/.test(digits(v)), message);

export const abnField = z.string({ required_error: 'Validation Error: Australian Business Number (ABN) must be exactly 11 digits.' })
  .refine(v => /^\d{11}$/.test(String(v).replace(/\s/g, '')), 'Validation Error: Australian Business Number (ABN) must be exactly 11 digits.');

export const passwordField = z.string().min(8, 'New password must be at least 8 characters.');

// POST /api/auth/register (public sign-up and admin "register company")
export const registerSchema = z.object({
  businessName: text(1, 'Missing required fields.'),
  primaryContactName: text(1, 'Missing required fields.'),
  phoneNumber: text(1, 'Missing required fields.'),
  email: emailField('Missing required fields.'),
  password: z.string({ required_error: 'Missing required fields.' }).min(8, 'Password must be at least 8 characters.')
}).passthrough();

// POST /api/customers (admin adds a company)
export const customerCreateSchema = z.object({
  businessName: text(2, 'Validation Error: Business/Company name is required (at least 2 characters).'),
  abn: abnField,
  primaryContactName: text(2, 'Validation Error: Primary contact person name is required.'),
  phoneNumber: phoneField('Validation Error: Please provide a valid phone number (8 to 12 digits).'),
  email: emailField('Validation Error: Please enter a valid business email address.')
}).passthrough();

// PUT /api/customers/:id/profile
export const profileSchema = z.object({
  businessName: z.string().optional(),
  primaryContactName: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.union([emailField(), z.literal('')]).optional(),
  password: z.union([passwordField, z.literal(''), z.null()]).optional()
}).passthrough();

// PUT /api/customers/:id/plan
export const planSchema = z.object({
  membershipPlan: z.enum(PLAN_IDS, { errorMap: () => ({ message: 'Unknown membership plan.' }) })
});

// POST /api/customers/:id/locations and PUT /api/locations/:id
export const siteCreateSchema = z.object({
  name: text(1, 'Location name and street address are required.'),
  address: text(1, 'Location name and street address are required.')
}).passthrough();

// POST /api/jobs
export const jobCreateSchema = z.object({
  description: text(1, 'Description, on-site contact and on-site phone are required.'),
  onsiteContact: text(1, 'Description, on-site contact and on-site phone are required.'),
  onsitePhone: text(1, 'Description, on-site contact and on-site phone are required.')
}).passthrough();

// PATCH /api/jobs/:id/status
export const jobStatusSchema = z.object({
  status: z.string().optional().refine(s => s === undefined || JOB_STATUSES.includes(s), s => ({ message: `Unknown status: ${s}` })),
  technicianName: z.string().optional(),
  notes: z.string().optional()
}).passthrough();

// POST /api/technicians
export const technicianCreateSchema = z.object({
  name: text(2, 'Technician name is required (at least 2 characters).'),
  phone: phoneField(),
  email: z.union([emailField(), z.literal('')]).optional()
}).passthrough();

// PATCH /api/technicians/:id/status
export const technicianStatusSchema = z.object({
  status: z.enum(TECHNICIAN_STATES, { errorMap: () => ({ message: 'Status must be AVAILABLE, ON_SITE or OFF_DUTY.' }) })
}).passthrough();

// PUT /api/technicians/:id/profile
export const technicianProfileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  password: z.union([passwordField, z.literal(''), z.null()]).optional()
}).passthrough();

// POST /api/redemptions
export const redemptionCreateSchema = z.object({
  serviceCode: z.string({ required_error: 'Unknown redemption service.' }),
  quantity: z.coerce.number({ invalid_type_error: 'Quantity must be more than zero.' }).positive('Quantity must be more than zero.')
}).passthrough();

// PATCH /api/redemptions/:id/status
export const redemptionDecisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], { errorMap: () => ({ message: 'Status must be APPROVED or REJECTED.' }) })
});

// PUT /api/config
export const configSchema = z.object({
  membershipPlans: z.array(z.object({ id: z.string() }).passthrough(), {
    required_error: 'Configuration must include at least one membership plan.',
    invalid_type_error: 'Configuration must include at least one membership plan.'
  }).min(1, 'Configuration must include at least one membership plan.')
}).passthrough();
