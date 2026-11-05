import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginAll } from './helpers.js';

describe('roles and company access', () => {
  let s;
  beforeAll(async () => { s = await loginAll(); });

  it('shows a customer only their own company', async () => {
    const res = await api('get', '/customers', s.mahima.accessToken);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(s.mahima.user.businessId);
    expect((await api('get', `/customers/${s.ross.user.businessId}`, s.mahima.accessToken)).status).toBe(403);
    expect((await api('get', '/customers', s.admin.accessToken)).body.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps admin-only actions for the admin', async () => {
    const t = s.mahima.accessToken;
    expect((await api('post', '/technicians', t).send({ name: 'Hack', phone: '0400000000' })).status).toBe(403);
    expect((await api('put', '/config', t).send({ membershipPlans: [{ id: 'x' }] })).status).toBe(403);
    expect((await api('get', '/analytics/summary', t)).status).toBe(403);
    expect((await api('delete', '/jobs/reset-all', t)).status).toBe(403);
  });

  it('validates config before saving', async () => {
    expect((await api('put', '/config', s.config.accessToken).send({ membershipPlans: [] })).status).toBe(400);
  });

  it('lets a customer add and edit their own sites only', async () => {
    const orgId = s.mahima.user.businessId;
    const add = await api('post', `/customers/${orgId}/locations`, s.mahima.accessToken)
      .send({ name: 'Unley Office', address: '1 Unley Rd, Unley SA 5061' });
    expect(add.status).toBe(200);
    expect((await api('post', `/customers/${orgId}/locations`, s.mahima.accessToken)
      .send({ name: 'Sydney', address: '1 George St, Sydney NSW 2000' })).status).toBe(400);
    expect((await api('put', `/locations/${add.body.id}`, s.ross.accessToken).send({ name: 'Mine now' })).status).toBe(403);
  });

  it('changes a customer password on the login account', async () => {
    const orgId = s.mahima.user.businessId;
    expect((await api('put', `/customers/${orgId}/profile`, s.mahima.accessToken).send({ password: 'short' })).status).toBe(400);
    expect((await api('put', `/customers/${orgId}/profile`, s.mahima.accessToken).send({ password: 'NewPass123!' })).status).toBe(200);
    const again = await api('post', '/auth/login').send({ email: 'mahima@mahimaenterprises.com.au', password: 'NewPass123!' });
    expect(again.status).toBe(200);
    await api('put', `/customers/${orgId}/profile`, again.body.accessToken).send({ password: 'Password123!' });
  });
});
