import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, api, loginAll } from './helpers.js';

describe('emergency job lifecycle', () => {
  let s, job;
  beforeAll(async () => {
    s = await loginAll();
    const res = await api('post', '/jobs', s.ross.accessToken)
      .send({ organizationId: s.mahima.user.businessId, description: 'Spill in foyer', onsiteContact: 'Ross', onsitePhone: '0418987654', category: 'Spill' });
    job = res.body;
  });

  it('saves a customer job to their own company with source PORTAL', () => {
    expect(job.organizationId).toBe(s.ross.user.businessId);
    expect(job.source).toBe('PORTAL');
    expect(job.status).toBe('NEW');
  });

  it('saves an admin hotline job with source HOTLINE', async () => {
    const res = await api('post', '/jobs', s.admin.accessToken)
      .send({ organizationId: s.ross.user.businessId, description: 'Hotline', onsiteContact: 'B', onsitePhone: '0400111222' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('HOTLINE');
  });

  it('requires description and contact details', async () => {
    expect((await api('post', '/jobs', s.ross.accessToken).send({ category: 'Spill' })).status).toBe(400);
  });

  it('only lets the assigned technician move the job, one step at a time', async () => {
    expect((await api('patch', `/jobs/${job.id}/status`, s.ross.accessToken).send({ status: 'COMPLETED' })).status).toBe(403);
    expect((await api('patch', `/jobs/${job.id}/status`, s.chris.accessToken).send({ status: 'ACCEPTED' })).status).toBe(403);
    const assign = await api('patch', `/jobs/${job.id}/status`, s.admin.accessToken).send({ status: 'TECH_ASSIGNED', technicianName: 'Chris Watson' });
    expect(assign.status).toBe(200);
    expect((await api('patch', `/jobs/${job.id}/status`, s.chris.accessToken).send({ status: 'IN_PROGRESS' })).status).toBe(400);
    expect((await api('patch', `/jobs/${job.id}/status`, s.admin.accessToken).send({ status: 'NOT_A_STATUS' })).status).toBe(400);
    for (const status of ['ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']) {
      const res = await api('patch', `/jobs/${job.id}/status`, s.chris.accessToken).send({ status });
      expect(res.status, status).toBe(200);
    }
  });

  it('stores the timeline, labour times and technician status', async () => {
    const res = await api('get', `/jobs/${job.id}`, s.ross.accessToken);
    expect(res.body.statusEvents.map(e => e.toStatus)).toEqual(['NEW', 'TECH_ASSIGNED', 'ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']);
    expect(res.body.workStartedAt).toBeTruthy();
    expect(res.body.completedAt).toBeTruthy();
    const techs = (await api('get', '/technicians', s.admin.accessToken)).body;
    expect(techs.find(t => t.name === 'Chris Watson').status).toBe('AVAILABLE');
    expect((await api('get', `/jobs/${job.id}`, s.mahima.accessToken)).status).toBe(403);
  });

  it('protects the printable report and fills it from the database', async () => {
    expect((await request(app).get(`/api/jobs/${job.id}/pdf-report`)).status).toBe(401);
    expect((await request(app).get(`/api/jobs/${job.id}/pdf-report?token=${s.mahima.accessToken}`)).status).toBe(403);
    const res = await request(app).get(`/api/jobs/${job.id}/pdf-report?token=${s.ross.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('PASSED');
    expect(res.text).not.toContain('Not recorded');
  });

  it('writes the changes to AuditLog', async () => {
    const res = await api('get', `/audit-logs?entityType=EmergencyRequest&entityId=${job.id}`, s.admin.accessToken);
    const actions = res.body.map(l => l.action);
    expect(actions).toContain('JOB_CREATED');
    expect(actions).toContain('JOB_ASSIGNED');
    expect(actions).toContain('JOB_STATUS_CHANGED');
  });

  it('reports real analytics to the admin', async () => {
    const res = await api('get', '/analytics/summary', s.admin.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.slaResponseSuccessRate).toBe('100.0%');
  });
});
