import { describe, it, expect, beforeAll } from 'vitest';
import { api, login, loginAll } from './helpers.js';

describe('admin: technicians, customers, points', () => {
  let s;
  beforeAll(async () => { s = await loginAll(); });

  it('creates, edits and deletes a technician with a one-time password', async () => {
    const res = await api('post', '/technicians', s.admin.accessToken).send({ name: 'Test Tech', phone: '0400 111 999' });
    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toBeTruthy();
    expect((await login(res.body.email, res.body.tempPassword)).accessToken).toBeTruthy();
    expect((await api('post', '/technicians', s.admin.accessToken).send({ name: 'Test Tech', phone: '0400111999' })).status).toBe(400);
    expect((await api('put', `/technicians/${res.body.id}`, s.admin.accessToken).send({ phone: '0400 222 333' })).body.phone).toBe('0400 222 333');
    expect((await api('delete', `/technicians/${res.body.id}`, s.admin.accessToken)).status).toBe(200);
  });

  it('creates a customer with a login, and deletes it', async () => {
    const res = await api('post', '/customers', s.admin.accessToken).send({
      businessName: 'Test Co', abn: '12345678901', primaryContactName: 'Tess', phoneNumber: '0412345678',
      email: 'tess@test.com.au', address: '1 King William St Adelaide SA 5000'
    });
    expect(res.status).toBe(200);
    expect((await login('tess@test.com.au', res.body.tempPassword)).accessToken).toBeTruthy();
    expect((await api('post', '/customers', s.admin.accessToken).send({ businessName: 'Bad', abn: '1' })).status).toBe(400);
    expect((await api('delete', `/customers/${res.body.id}`, s.admin.accessToken)).status).toBe(200);
  });

  it('works out redemption points on the server and deducts them once', async () => {
    const orgId = s.mahima.user.businessId;
    const site = (await api('get', `/customers/${orgId}`, s.mahima.accessToken)).body.locations[0];
    const req = await api('post', '/redemptions', s.mahima.accessToken).send({ locationId: site.id, serviceCode: 'carpet_steam', quantity: 10, calculatedPoints: 1 });
    expect(req.status).toBe(200);
    expect(req.body.redemption.calculatedPoints).toBe(50);

    const before = (await api('get', `/customers/${orgId}`, s.admin.accessToken)).body.pointsBalance;
    const id = req.body.redemption.id;
    expect((await api('patch', `/redemptions/${id}/status`, s.mahima.accessToken).send({ status: 'APPROVED' })).status).toBe(403);
    expect((await api('patch', `/redemptions/${id}/status`, s.admin.accessToken).send({ status: 'APPROVED' })).status).toBe(200);
    expect((await api('patch', `/redemptions/${id}/status`, s.admin.accessToken).send({ status: 'APPROVED' })).status).toBe(409);
    const after = (await api('get', `/customers/${orgId}`, s.admin.accessToken)).body.pointsBalance;
    expect(before - after).toBe(50);
  });
});
