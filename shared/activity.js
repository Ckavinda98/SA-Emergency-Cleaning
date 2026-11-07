// Plain-English names for the change history (AuditLog). Shared by the API and the Activity log page.

// kind: add | edit | delete | other
export const ACTIONS = {
  COMPANY_REGISTERED: { label: 'Registered a company', kind: 'add' },
  CUSTOMER_CREATED: { label: 'Added a customer', kind: 'add' },
  PROFILE_UPDATED: { label: 'Edited customer details', kind: 'edit' },
  PLAN_CHANGED: { label: 'Changed membership plan', kind: 'edit' },
  SUBSCRIPTION_CANCELLED: { label: 'Cancelled membership', kind: 'edit' },
  CUSTOMER_DELETED: { label: 'Deleted a customer', kind: 'delete' },
  LOCATION_CREATED: { label: 'Added a site', kind: 'add' },
  LOCATION_UPDATED: { label: 'Edited a site', kind: 'edit' },
  JOB_CREATED: { label: 'Created a request', kind: 'add' },
  JOB_EDITED: { label: 'Edited a request', kind: 'edit' },
  JOB_ASSIGNED: { label: 'Assigned a technician', kind: 'edit' },
  JOB_STATUS_CHANGED: { label: 'Changed job status', kind: 'edit' },
  JOB_EXTENSION_UPDATED: { label: 'Updated extra time', kind: 'edit' },
  JOBS_RESET: { label: 'Deleted all requests', kind: 'delete' },
  TECHNICIAN_CREATED: { label: 'Added a technician', kind: 'add' },
  TECHNICIAN_UPDATED: { label: 'Edited a technician', kind: 'edit' },
  TECHNICIAN_PROFILE_UPDATED: { label: 'Edited technician profile', kind: 'edit' },
  TECHNICIAN_STATUS_CHANGED: { label: 'Changed technician duty', kind: 'edit' },
  TECHNICIAN_DELETED: { label: 'Deleted a technician', kind: 'delete' },
  REDEMPTION_REQUESTED: { label: 'Requested a reward', kind: 'add' },
  REDEMPTION_APPROVED: { label: 'Approved a reward', kind: 'edit' },
  REDEMPTION_REJECTED: { label: 'Declined a reward', kind: 'edit' },
  INVOICE_CREATED: { label: 'Created an invoice', kind: 'add' },
  CONFIG_UPDATED: { label: 'Changed settings', kind: 'edit' }
};

export const actionInfo = (action) => ACTIONS[action] || {
  label: String(action || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()),
  kind: /CREATED|REGISTERED|REQUESTED/.test(action) ? 'add' : /DELETED|RESET/.test(action) ? 'delete' : /UPDATED|CHANGED|EDITED|ASSIGNED/.test(action) ? 'edit' : 'other'
};

export const KINDS = { add: 'Added', edit: 'Edited', delete: 'Deleted', other: 'Other' };

export const ENTITIES = {
  Organization: 'Customer',
  Location: 'Site',
  EmergencyRequest: 'Request / job',
  Technician: 'Technician',
  RedemptionRequest: 'Reward',
  Invoice: 'Invoice',
  SystemDynamicConfig: 'Settings'
};

export const ROLE_NAMES = { CUSTOMER: 'Customer', TECHNICIAN: 'Technician', ADMIN: 'Admin', CONFIG: 'Config' };

const FIELDS = {
  businessName: 'Company name', primaryContactName: 'Primary contact', phoneNumber: 'Phone', email: 'Email', abn: 'ABN',
  membershipPlan: 'Plan', subscriptionStatus: 'Membership status', password: 'Password', organizationId: 'Customer',
  name: 'Name', address: 'Address', contactName: 'Site contact', contactPhone: 'Contact phone',
  accessInstructions: 'Access instructions', securityNotes: 'Security notes', parkingInstructions: 'Parking',
  accessRestrictions: 'Access restrictions', jobNumber: 'Job number', category: 'Incident type', description: 'Description',
  source: 'Created from', status: 'Status', technicianName: 'Technician', workStartedAt: 'Work started', completedAt: 'Completed',
  timerMinutes: 'Minutes on site', affectedArea: 'Affected area (m²)', onsiteContact: 'On-site contact', onsitePhone: 'On-site phone',
  isOngoing: 'Still happening', isSafeToAccess: 'Safe to enter', incidentTime: 'Incident time', locationName: 'Site',
  phone: 'Phone', rating: 'Rating', activeJobId: 'Active job', serviceCode: 'Service', quantity: 'Quantity',
  calculatedPoints: 'Points', points: 'Points', deleted: 'Records deleted', extensionRequested: 'Extra time requested',
  extensionApproved: 'Extra time approved', additionalCharges: 'Extra charges', additionalCalloutFee: 'Extra call-out fee',
  labourRate: 'Labour rate', surchargeAmount: 'Surcharge', missedAccessFee: 'Missed access fee', lateCancellationFee: 'Late cancellation fee', tenureMinMonths: 'Months before points unlock', toiletOverflowDisclaimer: 'Toilet overflow notice',
  incidentCategories: 'Incident types', membershipPlans: 'Plans', redemptionServices: 'Reward services', publicHolidays: 'Public holidays', metroPostcodes: 'Metro postcodes', measuredArea: 'Measured area (m²)', triage: 'Triage', reportNumber: 'Report number', billingFrequency: 'Billing', membershipPlan: 'Plan', areaApproved: 'Outside metro approved', travelKm: 'Travel (km)', price: 'Price',
  callouts: 'Call-outs', hoursPerCallout: 'Hours per call-out', amount: 'Amount', loginEmail: 'Login email', customer: 'Customer', customerName: 'Customer', sites: 'Sites', pointsBalance: 'Points balance'
};

// "membershipPlans.business.price" -> "Plans › business › Price"
export const fieldLabel = (path) => String(path).split('.').map(p => FIELDS[p] || p).join(' › ');
