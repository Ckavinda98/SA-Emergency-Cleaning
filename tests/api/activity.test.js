import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginAll } from './helpers.js';

describe('activity log and config account editing', () => {
  let s;
  beforeAll(async () => { s = await loginAll(); });

  it('is only for admin and config', async () => {
    expect((await api('get', '/activity', s.mahima.accessToken)).status).toBe(403);
    expect((await api('get', '/activity', s.dave.accessToken)).status).toBe(403);
    expect((await api('get', '/activity', s.config.accessToken)).status).toBe(200);
  });

  it('lets config edit a customer and shows the change with before and after', async () => {
    const list = await api('get', '/customers', s.config.accessToken);
    const org = list.body.find(c => c.businessName.startsWith('Mahima'));
    const old = org.primaryContactName;
    const res = await api('put', `/customers/${org.id}/profile`, s.config.accessToken).send({ primaryContactName: 'Mahima Test-Sharma' });
    expect(res.status).toBe(200);

    const feed = await api('get', `/activity?entityType=Organization&entityId=${org.id}`, s.config.accessToken);
    const row = feed.body.items[0];
    expect(row.action).toBe('PROFILE_UPDATED');
    expect(row.kind).toBe('edit');
    expect(row.user.roleLabel).toBe('Config');
    expect(row.entityLabel).toBe(org.businessName);

    const detail = await api('get', `/activity/${row.id}`, s.config.accessToken);
    expect(detail.body.changes).toContainEqual(expect.objectContaining({ field: 'primaryContactName', from: old, to: 'Mahima Test-Sharma' }));

    await api('put', `/customers/${org.id}/profile`, s.config.accessToken).send({ primaryContactName: old });
  });

  it('lets config edit a technician but not add or delete one', async () => {
    const techs = await api('get', '/technicians', s.config.accessToken);
    const t = techs.body[0];
    expect((await api('put', `/technicians/${t.id}`, s.config.accessToken).send({ phone: t.phone })).status).toBe(200);
    expect((await api('post', '/technicians', s.config.accessToken).send({ name: 'New Person', phone: '0412345678' })).status).toBe(403);
    expect((await api('delete', `/technicians/${t.id}`, s.config.accessToken)).status).toBe(403);
  });

  it('filters by kind and search, and pages', async () => {
    const edits = await api('get', '/activity?kind=edit&pageSize=5', s.admin.accessToken);
    expect(edits.body.items.length).toBeLessThanOrEqual(5);
    expect(edits.body.items.every(r => r.kind === 'edit')).toBe(true);
    expect(edits.body.total).toBeGreaterThanOrEqual(edits.body.items.length);
    const found = await api('get', '/activity?q=Mahima', s.admin.accessToken);
    expect(found.body.items.length).toBeGreaterThan(0);
  });
});
