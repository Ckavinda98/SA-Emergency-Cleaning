// Default business configuration, taken from the client's Membership Agreement & Terms v1.0 (July 2026),
// Member Program Guide and Operations SOP. Clause numbers refer to the Agreement.
// The live values are stored in the database (SystemDynamicConfig) and edited in Config Studio;
// these defaults fill in anything that has not been saved yet. Shared by the web app and the API.
// All dollar amounts are ex GST (cl. 2.1).

export const CONFIG_VERSION = 2;

export const DEFAULT_PLANS = [
  // window: null = 24/7. afterHoursSurcharge / publicHolidaySurcharge: true when the $50 surcharge applies (cl. 7)
  { id: 'essential', name: 'Essential', price: 99, callouts: 1, hoursPerCallout: 1, labourRate: 95, window: { start: 6, end: 21 }, afterHoursSurcharge: true, publicHolidaySurcharge: true, priority: 3, priorityLabel: 'Third priority' },
  { id: 'business', name: 'Business', price: 199, callouts: 2, hoursPerCallout: 1, labourRate: 90, window: null, afterHoursSurcharge: true, publicHolidaySurcharge: true, priority: 2, priorityLabel: 'Second priority' },
  { id: 'premium', name: 'Premium', price: 399, callouts: 4, hoursPerCallout: 1, labourRate: 85, window: null, afterHoursSurcharge: false, publicHolidaySurcharge: false, priority: 1, priorityLabel: 'First priority' }
];

// South Australian public holidays (cl. 7). Edit in Config Studio each year.
export const DEFAULT_PUBLIC_HOLIDAYS = [
  '2026-01-01', '2026-01-26', '2026-03-09', '2026-04-03', '2026-04-04', '2026-04-06', '2026-04-25', '2026-06-08',
  '2026-10-05', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-28', '2026-12-31',
  '2027-01-01', '2027-01-26', '2027-03-08', '2027-03-26', '2027-03-27', '2027-03-29', '2027-04-26', '2027-06-14',
  '2027-10-04', '2027-12-24', '2027-12-25', '2027-12-27', '2027-12-28', '2027-12-31'
];

export const DEFAULT_CONFIG = {
  configVersion: CONFIG_VERSION,
  membershipPlans: DEFAULT_PLANS,
  gstRate: 0.1,
  additionalCalloutFee: 30, // cl. 8.1
  surchargeAmount: 50, // cl. 7, one per attendance
  earlyActivationFee: 100, // cl. 3.2
  waitingPeriodDays: 10, // cl. 3.1: included call-outs from day 11
  missedAccessFee: 100, // cl. 12.4
  lateCancellationFee: 100, // cl. 12.5
  disposalHandlingFee: 25, // cl. 8.4
  travelRatePerKm: 1.5, // cl. 18.2, each way from the GPO
  responseTargetHours: { min: 2, max: 4 }, // cl. 13.1
  goodwillPoints: 50, // cl. 13.5
  unusedCalloutPoints: 30, // cl. 14.3
  referralPoints: 100, // cl. 14.7
  pointsExpiryMonths: 12, // cl. 14.5
  tenureMinMonths: 6, // cl. 14.4: points redeemable after 6 consecutive months
  termMonths: 12, // cl. 5.1
  cancelAfterCalloutDays: 30, // cl. 5.2
  suspendAfterDays: 7, // cl. 4.4
  cancellationReviewAfterDays: 30, // cl. 5.4
  extrasPaymentTermsDays: 7, // cl. 4.3
  greyAreaDecisionMinutes: 15, // SOP triage D
  photoChaseMinutes: 10, // SOP call capture
  missedAccessWaitMinutes: 15, // SOP
  missedAccessCalls: 2, // SOP
  reportDueHours: 24, // cl. 16 / SOP
  workmanshipNoticeHours: 24, // cl. 20
  coverageLimits: { cleanWaterM2: 10, graffitiM2: 2 }, // cl. 9.1
  multiSiteDiscounts: [{ min: 2, max: 5, percent: 10 }, { min: 6, max: 10, percent: 15 }], // cl. 17.2; 11+ custom
  loyaltyLevels: [
    { id: 'gold', name: 'Gold', months: 60, benefit: 'Silver benefits plus 1 bonus included call-out each membership year' },
    { id: 'silver', name: 'Silver', months: 36, benefit: 'Bronze benefits plus 5% off periodical services', discountPercent: 5 },
    { id: 'bronze', name: 'Bronze', months: 12, benefit: 'Priority booking for periodical services' }
  ],
  publicHolidays: DEFAULT_PUBLIC_HOLIDAYS,
  // Metro Adelaide postcodes (cl. 18.1). Others in SA are outside metro and need approval plus travel.
  metroPostcodes: { ranges: [[5000, 5115], [5122, 5174], [5950, 5950]] },
  toiletOverflowDisclaimer: 'Cleaning and sanitising only. SA Commercial Cleaning Services Pty Ltd does not provide plumbing, drain clearing or toilet unclogging services.',
  // cl. 14.2 / 14.4: 1 point = $1 off these periodical services, against SACC's quote
  redemptionServices: [
    { code: 'carpet_steam', name: 'Carpet steam cleaning' },
    { code: 'windows', name: 'Window cleaning' },
    { code: 'pressure_wash', name: 'Pressure washing' },
    { code: 'floor_scrub', name: 'Machine floor scrubbing' }
  ],
  // cl. 9.1 covered incidents
  incidentCategories: [
    'Spill clean-up', 'Vomit, urine or faeces', 'Toilet overflow', 'Burst pipe or water leak', 'Wet carpet',
    'Slip hazard', 'Carpet spot cleaning', 'Broken glass', 'Minor graffiti', 'Emergency kitchen or bathroom clean-up',
    'Bin leakage', 'Other (SACC to assess)'
  ],
  // Categories that use the clean water and graffiti limits
  waterCategories: ['Burst pipe or water leak', 'Wet carpet'],
  graffitiCategories: ['Minor graffiti']
};

// The live config merged over the defaults, so older saved settings still get every new rule
export function withDefaults(stored) {
  if (!stored) return DEFAULT_CONFIG;
  const merged = { ...DEFAULT_CONFIG, ...stored };
  merged.membershipPlans = (stored.membershipPlans?.length ? stored.membershipPlans : DEFAULT_PLANS)
    .map(p => ({ ...(DEFAULT_PLANS.find(d => d.id === p.id) || {}), ...p }));
  if ((stored.configVersion || 1) < CONFIG_VERSION) {
    // Settings saved before the documents were applied: take the documented lists and wording
    merged.incidentCategories = DEFAULT_CONFIG.incidentCategories;
    merged.toiletOverflowDisclaimer = DEFAULT_CONFIG.toiletOverflowDisclaimer;
    merged.redemptionServices = DEFAULT_CONFIG.redemptionServices;
    merged.configVersion = CONFIG_VERSION;
  }
  delete merged.overageHourlyRate; // replaced by labourRate on each plan
  delete merged.redemptionRates; // replaced by redemptionServices (1 point = $1)
  return merged;
}

export const PLAN_IDS = DEFAULT_PLANS.map(p => p.id);

export const planFor = (config, planId) => {
  const plans = config?.membershipPlans?.length ? config.membershipPlans : DEFAULT_PLANS;
  return plans.find(p => p.id === planId) || plans.find(p => p.id === 'business') || plans[0];
};

// Call-outs included per month, from the configured plan
export const allowedCallouts = (planId, config = DEFAULT_CONFIG) => planFor(config, planId)?.callouts ?? 0;
