// Job statuses and the order a technician moves through them. Shared by the web app and the API.
export const JOB_STATUSES = [
  'NEW', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'DECLINED', 'CONVERTED_TO_QUOTE',
  'ACCEPTED', 'TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS',
  'UNABLE_TO_ACCESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'CANCELLED'
];

// A job in one of these is over: the technician is free again
export const FINISHED_STATUSES = ['COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'CANCELLED', 'DECLINED'];

// Completed work (used by reports and analytics)
export const COMPLETED_STATUSES = ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'];

// Still being worked on
export const ACTIVE_STATUSES = ['NEW', 'SUBMITTED', 'ACCEPTED', 'TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'];

// The steps a technician may take: current status -> allowed next statuses
export const TECHNICIAN_TRANSITIONS = {
  NEW: ['ACCEPTED'],
  SUBMITTED: ['ACCEPTED'],
  TECH_ASSIGNED: ['ACCEPTED'],
  TECHNICIAN_ASSIGNED: ['ACCEPTED'],
  ACCEPTED: ['TRAVELLING'],
  TRAVELLING: ['ARRIVED'],
  ARRIVED: ['IN_PROGRESS', 'UNABLE_TO_ACCESS'],
  IN_PROGRESS: ['COMPLETED']
};

export const canTechnicianMove = (from, to) => (TECHNICIAN_TRANSITIONS[from] || []).includes(to);

// Lifecycle stages shown on the service report, with the statuses that mark each one
export const TIMELINE_STAGES = [
  { label: '1. Request Submitted', statuses: ['NEW', 'SUBMITTED'] },
  { label: '2. Admin Dispatched', statuses: ['TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED'] },
  { label: '3. Technician Accepted', statuses: ['ACCEPTED'] },
  { label: '4. En Route (Transit Start)', statuses: ['TRAVELLING'] },
  { label: '5. Arrived On-Site', statuses: ['ARRIVED'] },
  { label: '6. Cleaning Commenced', statuses: ['IN_PROGRESS'] },
  { label: '7. Job Completed', statuses: ['COMPLETED'] }
];

export const TECHNICIAN_STATES = ['AVAILABLE', 'ON_SITE', 'OFF_DUTY'];
