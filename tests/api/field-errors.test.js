import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginAll } from './helpers.js';

// Forms show each API message under its own field, so a 400 lists them by field name
describe('per-field validation errors from the API', () => {
  let s;
  beforeAll(async () => { s = await loginAll(); });

  it('names every field that fails on register', async () => {
    const res = await api('post', '/auth/register').send({
      businessName: 'Acme Cleaning', primaryContactName: 'J0hn', phoneNumber: '0412abc', email: 'not-an-email', password: 'weak'
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['primaryContactName', 'phoneNumber', 'email', 'password']));
    expect(res.body.fields.businessName).toBeUndefined();
    expect(res.body.error).toBeTruthy();
  });

  it('checks a site phone number on update but only the fields sent', async () => {
    const me = await api('get', '/customers', s.mahima.accessToken);
    const org = (Array.isArray(me.body) ? me.body : [me.body])[0];
    const site = org.locations[0];
    const bad = await api('put', `/locations/${site.id}`, s.mahima.accessToken).send({ contactPhone: '12345' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.contactPhone).toMatch(/Australian phone number/);
    const ok = await api('put', `/locations/${site.id}`, s.mahima.accessToken).send({ accessInstructions: site.accessInstructions || 'Front desk' });
    expect(ok.status).toBe(200);
  });
});
