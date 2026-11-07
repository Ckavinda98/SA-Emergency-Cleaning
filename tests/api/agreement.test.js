// The client's Membership Agreement rules, end to end through the API
import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginAll, login } from './helpers.js';
import { prisma } from '../../server/db/prisma.js';
import { runHousekeeping } from '../../server/lib/housekeeping.js';

const newJob = (token, extra = {}) => api('post', '/jobs', token)
  .send({ description: 'Water on the floor', onsiteContact: 'Ross Lee', onsitePhone: '0418987654', category: 'Spill clean-up', ...extra });

describe('membership agreement rules', () => {
  let s, rossOrg;
  beforeAll(async () => {
    s = await loginAll();
    rossOrg = s.ross.user.businessId;
  });

  it('gives a new member 0 opening points, then fee points, a membership number and a referral reward', async () => {
    const referrer = (await api('get', `/customers/${rossOrg}`, s.ross.accessToken)).body;
    const before = referrer.pointsBalance;
    const res = await api('post', '/auth/register').send({
      businessName: 'Norwood Deli', primaryContactName: 'Nina Park', phoneNumber: '0412000222', email: 'nina@norwooddeli.com.au',
      password: 'Secret123!', address: '10 The Parade, Norwood SA 5067', membershipPlan: 'essential', billingFrequency: 'MONTHLY', referralCode: referrer.referralCode
    });
    expect(res.status).toBe(200);
    const nina = await login('nina@norwooddeli.com.au', 'Secret123!');
    const org = (await api('get', `/customers/${nina.user.businessId}`, nina.accessToken)).body;
    expect(org.pointsBalance).toBe(99); // 1 point per $1 of the first fee
    expect(org.membershipNumber).toMatch(/^SACC-M/);
    expect(org.membership.inWaitingPeriod).toBe(true);
    expect(org.membership.labourRate).toBe(95);
    expect((await api('get', `/customers/${rossOrg}`, s.ross.accessToken)).body.pointsBalance).toBe(before + 100);

    // Waiting period: the request is allowed with the $100 early activation fee
    const job = (await newJob(nina.accessToken)).body;
    const triaged = await api('post', `/jobs/${job.id}/triage`, s.admin.accessToken).send({ outcome: 'COVERED' });
    expect(triaged.body.earlyActivation).toBe(true);
    expect(triaged.body.charges.lines.map(l => l.code)).toContain('EARLY_ACTIVATION');
  });

  it('accepts outside-metro SA sites for approval and refuses interstate ones', async () => {
    const out = await api('post', '/auth/register').send({
      businessName: 'Gawler Garage', primaryContactName: 'Gus Hill', phoneNumber: '0412000333', email: 'gus@gawlergarage.com.au',
      password: 'Secret123!', address: '1 Murray St, Gawler SA 5118'
    });
    expect(out.status).toBe(200);
    expect(out.body.customer.locations[0].serviceArea).toBe('OUTSIDE_METRO');
    expect(out.body.customer.locations[0].areaApproved).toBe(false);
    const nsw = await api('post', '/auth/register').send({
      businessName: 'Sydney Co', primaryContactName: 'Sam Ray', phoneNumber: '0412000444', email: 'sam@sydneyco.com.au',
      password: 'Secret123!', address: '1 George St, Sydney NSW 2000'
    });
    expect(nsw.status).toBe(400);
  });

  it('never blocks a request when included call-outs are used up: it becomes a $30 additional call-out', async () => {
    const org = (await api('get', `/customers/${rossOrg}`, s.ross.accessToken)).body;
    const site = org.locations[0];
    await prisma.location.update({ where: { id: site.id }, data: { calloutsUsed: 4 } });
    const res = await newJob(s.ross.accessToken, { locationId: site.id });
    expect(res.status).toBe(200);
    expect(res.body.targetAttendanceAt).toBe(null); // clock starts at acknowledgment
    const ack = await api('post', `/jobs/${res.body.id}/acknowledge`, s.admin.accessToken);
    expect(new Date(ack.body.targetAttendanceAt) - new Date(ack.body.acknowledgedAt)).toBe(4 * 3600000);
    const t = await api('post', `/jobs/${res.body.id}/triage`, s.admin.accessToken).send({ outcome: 'COVERED' });
    expect(t.body.calloutType).toBe('ADDITIONAL');
    expect(t.body.charges.lines.find(l => l.code === 'ADDITIONAL_CALLOUT').amount).toBe(30);
    await prisma.location.update({ where: { id: site.id }, data: { calloutsUsed: 0 } });
  });

  it('uses no call-out for specialist work, and gives it back when the quote is declined', async () => {
    const job = (await newJob(s.ross.accessToken, { category: 'Wet carpet', affectedArea: 25, waterType: 'CLEAN' })).body;
    expect(job.coverageWarnings.length).toBe(1);
    const covered = await api('post', `/jobs/${job.id}/triage`, s.admin.accessToken).send({ outcome: 'COVERED' });
    expect(covered.body.calloutType).toBe('INCLUDED');
    const used = (await api('get', `/customers/${rossOrg}`, s.ross.accessToken)).body.membership.used;
    const quoted = await api('post', `/jobs/${job.id}/triage`, s.admin.accessToken).send({ outcome: 'SPECIALIST', quoteAmount: 900 });
    expect(quoted.body.status).toBe('CONVERTED_TO_QUOTE');
    expect(quoted.body.calloutType).toBe('NONE');
    expect((await api('get', `/customers/${rossOrg}`, s.ross.accessToken)).body.membership.used).toBe(used - 1);
    const declined = await api('post', `/jobs/${job.id}/quote`, s.ross.accessToken).send({ decision: 'DECLINED' });
    expect(declined.body.status).toBe('CLOSED');
  });

  it('cancels free before dispatch and charges $100 after dispatch', async () => {
    const a = (await newJob(s.ross.accessToken)).body;
    const free = await api('post', `/jobs/${a.id}/cancel`, s.ross.accessToken);
    expect(free.body.status).toBe('CANCELLED');
    expect(free.body.charges.subtotal).toBe(0);
    const b = (await newJob(s.ross.accessToken)).body;
    await api('patch', `/jobs/${b.id}/status`, s.admin.accessToken).send({ status: 'TECH_ASSIGNED', technicianName: 'Chris Watson' });
    const late = await api('post', `/jobs/${b.id}/cancel`, s.ross.accessToken);
    expect(late.body.cancellationFee).toBe(100);
    expect(late.body.charges.lines.map(l => l.code)).toContain('LATE_CANCELLATION');
  });

  it('records missed access only after the calls and an entrance photo, and issues a numbered report with an invoice', async () => {
    const job = (await newJob(s.ross.accessToken)).body;
    await api('patch', `/jobs/${job.id}/status`, s.admin.accessToken).send({ status: 'TECH_ASSIGNED', technicianName: 'Chris Watson' });
    for (const status of ['ACCEPTED', 'TRAVELLING', 'ARRIVED']) await api('patch', `/jobs/${job.id}/status`, s.chris.accessToken).send({ status });
    expect((await api('patch', `/jobs/${job.id}/status`, s.chris.accessToken).send({ status: 'UNABLE_TO_ACCESS' })).status).toBe(400);
    expect((await api('post', `/jobs/${job.id}/missed-access`, s.chris.accessToken).send({ calls: 2, entrancePhoto: 'data:x' })).status).toBe(400); // 15 minutes not up
    const res = await api('post', `/jobs/${job.id}/missed-access`, s.admin.accessToken).send({ calls: 2, entrancePhoto: 'data:image/png;base64,AA' });
    expect(res.body.status).toBe('UNABLE_TO_ACCESS');
    const report = await api('post', `/jobs/${job.id}/report`, s.admin.accessToken);
    expect(report.body.reportNumber).toMatch(/^SR-\d{4}-\d{4}$/);
    const invoices = (await api('get', `/customers/${rossOrg}/invoices`, s.admin.accessToken)).body;
    const extras = invoices.find(i => i.jobId === job.id);
    expect(extras.amount).toBe(100);
    expect(Math.round((new Date(extras.dueDate) - Date.now()) / 86400000)).toBe(7);
  });

  it('upgrades now with a pro-rata charge and schedules downgrades', async () => {
    const mahimaOrg = s.mahima.user.businessId;
    const up = await api('put', `/customers/${mahimaOrg}/plan`, s.mahima.accessToken).send({ membershipPlan: 'premium' });
    expect(up.body.upgrade).toBe(true);
    expect(up.body.customer.membershipPlan).toBe('premium');
    const down = await api('put', `/customers/${mahimaOrg}/plan`, s.mahima.accessToken).send({ membershipPlan: 'essential' });
    expect(down.body.upgrade).toBe(false);
    expect(down.body.customer.membershipPlan).toBe('premium');
    expect(down.body.customer.pendingPlan).toBe('essential');
    await api('put', `/customers/${mahimaOrg}/plan`, s.mahima.accessToken).send({ membershipPlan: 'premium' });
  });

  it('blocks cancelling within 30 days of a call-out; staff can cancel; points are cancelled', async () => {
    const nina = await login('nina@norwooddeli.com.au', 'Secret123!');
    const orgId = nina.user.businessId;
    const blocked = await api('post', `/customers/${orgId}/cancel-subscription`, nina.accessToken);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/30 days/);
    const done = await api('post', `/customers/${orgId}/cancel-subscription`, s.admin.accessToken);
    expect(done.status).toBe(200);
    expect(done.body.customer.pointsBalance).toBe(0);
    expect(done.body.customer.subscriptionStatus).toBe('CANCELLED');
  });

  it('converts unused call-outs to 30 points each and resets on a new month; expires old points', async () => {
    const org = (await api('get', `/customers/${rossOrg}`, s.ross.accessToken)).body;
    const before = org.pointsBalance;
    const unused = org.membership.sites.reduce((sum, x) => sum + x.remaining, 0);
    await prisma.systemDynamicConfig.upsert({ where: { configKey: 'HOUSEKEEPING_STATE' }, update: { configValue: JSON.stringify({ monthKey: '2000-01' }) }, create: { configKey: 'HOUSEKEEPING_STATE', configValue: JSON.stringify({ monthKey: '2000-01' }) } });
    await prisma.pointsEntry.create({ data: { organizationId: rossOrg, points: 7, remaining: 7, reason: 'ADJUSTMENT', expiresAt: new Date(Date.now() - 1000) } });
    await prisma.organization.update({ where: { id: rossOrg }, data: { pointsBalance: { increment: 7 } } });
    await runHousekeeping();
    const after = (await api('get', `/customers/${rossOrg}`, s.ross.accessToken)).body;
    expect(after.pointsBalance).toBe(before + unused * 30);
    expect(after.membership.used).toBe(0);
    const history = (await api('get', `/customers/${rossOrg}/points`, s.ross.accessToken)).body;
    expect(history.map(h => h.reason)).toContain('EXPIRED');
  });

  it('suspends a member 7 days after a payment notice', async () => {
    await api('post', `/customers/${rossOrg}/payment-status`, s.admin.accessToken).send({ failed: true });
    await prisma.organization.update({ where: { id: rossOrg }, data: { paymentNoticeAt: new Date(Date.now() - 8 * 86400000) } });
    await runHousekeeping();
    expect((await api('get', `/customers/${rossOrg}`, s.admin.accessToken)).body.subscriptionStatus).toBe('SUSPENDED');
    const paid = await api('post', `/customers/${rossOrg}/payment-status`, s.admin.accessToken).send({ failed: false });
    expect(paid.body.subscriptionStatus).toBe('ACTIVE');
  });
});
