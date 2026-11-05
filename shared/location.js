// Service area: Adelaide, South Australia only (postcodes 5000-5199). Shared by the web app and the API.
export const ADELAIDE_SUBURBS = [
  'Adelaide', 'North Adelaide', 'Port Adelaide', 'Norwood', 'Unley', 'Glenelg',
  'Mawson Lakes', 'Marion', 'Salisbury', 'Elizabeth', 'Prospect', 'Modbury',
  'Campbelltown', 'Burnside', 'Mitcham', 'Glen Osmond', 'St Peters', 'Henley Beach',
  'Semaphor', 'West Lakes', 'Golden Grove', 'Mount Barker', 'Gawler', 'Christies Beach'
];

export const ADELAIDE_ERROR = 'Location Error: Service is restricted to Adelaide, South Australia (postcodes 5000-5199).';

export function isAdelaideLocation(addressText) {
  if (!addressText) return false;
  const lower = addressText.toLowerCase();
  if (lower.includes('adelaide') || lower.includes('sa 5') || lower.includes('south australia')) return true;
  return ADELAIDE_SUBURBS.some(suburb => lower.includes(suburb.toLowerCase()));
}
