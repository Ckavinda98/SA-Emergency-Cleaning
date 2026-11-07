// Service area (Agreement cl. 18): the Adelaide metro area, plus sites elsewhere in South Australia
// that SACC accepts at its discretion with a travel charge. Shared by the web app and the API.
import { serviceArea } from './membership.js';

export const ADELAIDE_ERROR = 'Location Error: SACC services sites in South Australia only. Please enter an SA address with its postcode.';

// True for any site SACC can accept (metro, or outside metro for approval)
export function isAdelaideLocation(addressText, config) {
  if (!addressText) return false;
  return serviceArea(addressText, config) !== 'OUTSIDE_SA';
}

export const isMetroLocation = (addressText, config) => serviceArea(addressText, config) === 'METRO';
