import { describe, it, expect } from 'vitest';
import { canTechnicianMove } from '../../shared/jobStatus.js';
import { allowedCallouts, redemptionPoints } from '../../shared/config.js';
import { canOpenHash } from '../../shared/roles.js';
import { isAdelaideLocation } from '../../shared/location.js';
import { technicianCreateSchema } from '../../shared/schemas.js';

describe('shared business rules', () => {
  it('moves a technician one step at a time', () => {
    expect(canTechnicianMove('TECH_ASSIGNED', 'ACCEPTED')).toBe(true);
    expect(canTechnicianMove('ACCEPTED', 'IN_PROGRESS')).toBe(false);
    expect(canTechnicianMove('COMPLETED', 'ACCEPTED')).toBe(false);
  });
  it('knows the call-outs per plan', () => {
    expect(allowedCallouts('essential')).toBe(1);
    expect(allowedCallouts('premium')).toBe(4);
    expect(allowedCallouts('unknown')).toBe(2);
  });
  it('rounds redemption points up', () => {
    expect(redemptionPoints({ points: 5 }, 2.1)).toBe(11);
  });
  it('limits screens by role', () => {
    expect(canOpenHash('customer', '#admin/dispatch')).toBe(false);
    expect(canOpenHash('admin', '#config')).toBe(true);
  });
  it('accepts Adelaide addresses only', () => {
    expect(isAdelaideLocation('5 Jetty Rd, Glenelg SA 5045')).toBe(true);
    expect(isAdelaideLocation('1 George St, Sydney NSW 2000')).toBe(false);
  });
  it('validates a new technician', () => {
    expect(technicianCreateSchema.safeParse({ name: 'A', phone: '0400000000' }).success).toBe(false);
    expect(technicianCreateSchema.safeParse({ name: 'Al Smith', phone: '0400 000 000' }).success).toBe(true);
  });
});
