// Default business configuration (plans, fees, redemption rates, incident list).
// The live values are stored in the database (SystemDynamicConfig) and edited in Config Studio;
// these defaults are used when nothing has been saved yet. Shared by the web app and the API.
export const DEFAULT_CONFIG = {
  membershipPlans: [
    { id: 'essential', name: 'Essential', price: 99, callouts: 1, hoursPerCallout: 1 },
    { id: 'business', name: 'Business', price: 199, callouts: 2, hoursPerCallout: 1 },
    { id: 'premium', name: 'Premium', price: 399, callouts: 4, hoursPerCallout: 1 }
  ],
  additionalCalloutFee: 30,
  overageHourlyRate: 120,
  toiletOverflowDisclaimer: "Cleaning of the affected area and surrounding surfaces only. SA Emergency Cleaning Pty Ltd does not provide plumbing, blockage removal, drain clearing or toilet unclogging services.",
  tenureMinMonths: 6,
  redemptionRates: [
    { code: 'carpet_steam', name: 'Carpet Steam Cleaning', unit: 'm²', points: 5 },
    { code: 'carpet_encap', name: 'Carpet Encapsulation', unit: 'm²', points: 3 },
    { code: 'floor_scrubbing', name: 'Machine Floor Scrubbing', unit: 'm²', points: 4 },
    { code: 'pressure_clean', name: 'Pressure Cleaning', unit: 'm²', points: 4 },
    { code: 'tile_grout', name: 'Tile & Grout Cleaning', unit: 'm²', points: 7 },
    { code: 'win_internal', name: 'Internal Windows', unit: 'panel', points: 8 },
    { code: 'win_external', name: 'External Windows', unit: 'panel', points: 10 },
    { code: 'win_high', name: 'High-Level Windows', unit: 'panel', points: 18 },
    { code: 'deep_clean', name: 'Deep Cleaning', unit: 'hour', points: 100 },
    { code: 'high_dusting', name: 'High Dusting', unit: 'hour', points: 100 }
  ],
  incidentCategories: [
    'Spill', 'Vomit', 'Urine or faeces', 'Carpet stain', 'Water leak', 
    'Wet carpet', 'Toilet overflow', 'Broken glass', 'Oil or grease spill', 
    'Bin leakage', 'Emergency bathroom cleaning', 'Emergency kitchen cleaning', 
    'Minor graffiti', 'Other'
  ]
};

// Call-outs included per month for each plan id
export const PLAN_CALLOUTS = { essential: 1, business: 2, premium: 4 };
export const PLAN_IDS = Object.keys(PLAN_CALLOUTS);
export const allowedCallouts = (planId) => PLAN_CALLOUTS[planId] ?? PLAN_CALLOUTS.business;

// Points needed for a redemption, worked out from the configured rate
export const redemptionPoints = (rate, quantity) => Math.ceil(rate.points * Number(quantity));
