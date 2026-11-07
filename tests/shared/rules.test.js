import { describe, it, expect } from 'vitest';
import { canTechnicianMove } from '../../shared/jobStatus.js';
import { allowedCallouts, redemptionPoints } from '../../shared/config.js';
import { canOpenHash, canOpenPath, tabForPath, LEGACY_HASH_PATHS } from '../../shared/roles.js';
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


describe('page paths (redesigned web app)', () => {
  it('maps paths to workspaces', () => {
    expect(tabForPath('/app')).toBe('customer');
    expect(tabForPath('/app/requests/new')).toBe('customer');
    expect(tabForPath('/apple')).toBe(null);
    expect(tabForPath('/tech/jobs/1')).toBe('technician');
    expect(tabForPath('/admin/customers')).toBe('admin');
    expect(tabForPath('/settings/pricing')).toBe('config');
    expect(tabForPath('/login')).toBe(null);
  });
  it('lets each role open only its own pages', () => {
    expect(canOpenPath('customer', '/app/rewards')).toBe(true);
    expect(canOpenPath('customer', '/admin/dispatch')).toBe(false);
    expect(canOpenPath('technician', '/app')).toBe(false);
    expect(canOpenPath('config', '/settings/pricing')).toBe(true);
    expect(canOpenPath('config', '/admin/dispatch')).toBe(false);
    expect(canOpenPath('admin', '/app/rewards')).toBe(true);
    expect(canOpenPath('admin', '/tech/jobs')).toBe(true);
  });
  it('redirects every old hash link to a page', () => {
    for (const path of Object.values(LEGACY_HASH_PATHS)) expect(path.startsWith('/')).toBe(true);
    expect(LEGACY_HASH_PATHS['#customer/profile']).toBe('/app/account/profile');
  });
});
