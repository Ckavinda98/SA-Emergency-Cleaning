import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginAll } from './helpers.js';

describe('global search and per-role data', () => {
  let s;
  beforeAll(async () => { s = await loginAll(); });

  it('needs a login', async () => {
    expect((await api('get', '/search?q=toilet')).status).toBe(401);
  });

  it('only finds a customer their own company records', async () => {
    const mine = await api('get', '/search?q=toilet', s.mahima.accessToken);
    expect(mine.status).toBe(200);
    expect(mine.body.results.length).toBeGreaterThan(0);
    expect(mine.body.results.every(r => ['job', 'site'].includes(r.type))).toBe(true);
    expect(mine.body.results.filter(r => r.type === 'job').every(r => r.url.startsWith('/app/requests/'))).toBe(true);

    // Another company's customer gets nothing for Mahima's company name
    const other = await api('get', '/search?q=mahima', s.ross.accessToken);
    expect(other.body.results.filter(r => r.type === 'job')).toHaveLength(0);
  });

  it('gives an admin customers and technicians too', async () => {
    const res = await api('get', '/search?q=dave', s.admin.accessToken);
    expect(res.body.results.some(r => r.type === 'technician' && r.url.startsWith('/admin/technicians/'))).toBe(true);
    const cust = await api('get', '/search?q=adelaide tower', s.admin.accessToken);
    expect(cust.body.results.some(r => r.type === 'customer')).toBe(true);
  });

  it('limits a technician to their own jobs', async () => {
    const all = await api('get', '/jobs', s.admin.accessToken);
    const daveJobs = await api('get', '/jobs', s.dave.accessToken);
    const chrisJobs = await api('get', '/jobs', s.chris.accessToken);
    expect(daveJobs.body.every(j => (j.technicianName || '').startsWith('Dave Miller'))).toBe(true);
    expect(chrisJobs.body.every(j => (j.technicianName || '').startsWith('Chris Watson'))).toBe(true);
    expect(daveJobs.body.length + chrisJobs.body.length).toBeLessThanOrEqual(all.body.length);

    const search = await api('get', '/search?q=sacc', s.chris.accessToken);
    expect(search.body.results.every(r => r.type === 'job' && r.url.startsWith('/tech/jobs/'))).toBe(true);
    const ids = new Set(chrisJobs.body.map(j => j.id));
    expect(search.body.results.every(r => ids.has(r.id))).toBe(true);
  });

  it('works out technician status from their jobs', async () => {
    const res = await api('get', '/technicians', s.admin.accessToken);
    for (const t of res.body) {
      expect(['AVAILABLE', 'ON_SITE', 'OFF_DUTY']).toContain(t.status);
      expect(typeof t.workingJobs).toBe('number');
      expect(typeof t.completedJobs).toBe('number');
      if (t.status === 'ON_SITE') expect(t.workingJobs).toBeGreaterThan(0);
    }
  });

  it('ignores very short queries', async () => {
    const res = await api('get', '/search?q=a', s.admin.accessToken);
    expect(res.body.results).toHaveLength(0);
  });
});
