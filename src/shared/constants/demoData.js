// Starting values shown before the API answers (and demo data for offline screens).
// Default Dynamic Configuration State (Editable live in Admin Studio)
export const initialDynamicConfig = {
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

// Initial Mock Customers
export const initialCustomerAccounts = [
  {
    id: 'cust-1',
    businessName: "Mahima Commercial Enterprises Pty Ltd",
    abn: "48 123 456 789",
    primaryContactName: "Mahima Sharma",
    phoneNumber: "0412 345 678",
    email: "mahima@mahimaenterprises.com.au",
    membershipPlan: "business",
    paymentMethod: "PayTo Bank Direct",
    consecutiveMonths: 8,
    pointsBalance: 1592,
    calloutsUsed: 0,
    locations: [
      {
        id: 'loc-1',
        name: 'Adelaide CBD Headquarters',
        address: '120 Grenfell Street, Adelaide SA 5000',
        contactName: 'Sarah Jenkins',
        contactPhone: '0433 111 222',
        accessInstructions: 'Keypad Code #4829 on Rear Service Door after 6 PM',
        securityNotes: 'Security Guard on site 24/7. Check in at reception desk.'
      },
      {
        id: 'loc-2',
        name: 'Port Adelaide Distribution Hub',
        address: '45 Ocean Steamers Road, Port Adelaide SA 5015',
        contactName: 'Mark Vance',
        contactPhone: '0422 999 888',
        accessInstructions: 'Gate 3 Lockbox 1928. Key card inside.',
        securityNotes: 'Hi-Vis vest & steel cap boots required in warehouse.'
      }
    ]
  },
  {
    id: 'cust-2',
    businessName: "Adelaide Corporate Tower Management",
    abn: "99 876 543 210",
    primaryContactName: "David Ross",
    phoneNumber: "0418 987 654",
    email: "dross@adelaidetower.com.au",
    membershipPlan: "premium",
    paymentMethod: "PayTo Bank Direct",
    consecutiveMonths: 12,
    pointsBalance: 3192,
    calloutsUsed: 1,
    locations: [
      {
        id: 'loc-3',
        name: 'King William Street Tower',
        address: '80 King William Street, Adelaide SA 5000',
        contactName: 'David Ross',
        contactPhone: '0418 987 654',
        accessInstructions: 'Security Desk Master Key Card #04',
        securityNotes: 'After hours swipe card required at lift lobby.'
      }
    ]
  }
];

export const initialTechniciansList = [
  { id: 'tech-1', name: 'Dave Miller', phone: '0488 111 222', status: 'ON_SITE', activeJobId: 'SACC-2026-0812', rating: 4.9, avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80' },
  { id: 'tech-2', name: 'Chris Watson', phone: '0477 333 444', status: 'AVAILABLE', activeJobId: null, rating: 5.0, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' }
];
