import { describe, it, expect, beforeAll } from 'vitest';
import { api, login, loginAll, USERS } from './helpers.js';

describe('login and sessions', () => {
  let s;
  beforeAll(async () => { s = await loginAll(); });

  it('refuses an unknown email, a wrong password and missing fields', async () => {
    expect((await api('post', '/auth/login').send({ email: 'nobody@x.com', password: 'x' })).status).toBe(401);
    expect((await api('post', '/auth/login').send({ email: USERS.admin, password: 'bad' })).status).toBe(401);
    expect((await api('post', '/auth/login').send({})).status).toBe(400);
  });

  it('logs every role in from the database', () => {
    for (const key of Object.keys(USERS)) expect(s[key].accessToken, key).toBeTruthy();
    expect(s.mahima.user.role).toBe('customer');
    expect(s.dave.user.techId).toBeTruthy();
  });

  it('needs a token on private routes', async () => {
    expect((await api('get', '/customers')).status).toBe(401);
    expect((await api('get', '/health')).status).toBe(200);
  });

  it('revokes the refresh token on logout', async () => {
    const chris = await login(USERS.chris);
    expect((await api('post', '/auth/logout', chris.accessToken)).status).toBe(200);
    expect((await api('post', '/auth/refresh').send({ refreshToken: chris.refreshToken })).status).toBe(403);
  });

  it('rotates refresh tokens', async () => {
    const first = await login(USERS.ross);
    const res = await api('post', '/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(res.status).toBe(200);
    expect((await api('post', '/auth/refresh').send({ refreshToken: first.refreshToken })).status).toBe(403);
  });

  it('records every login event in LoginLog', async () => {
    const res = await api('get', '/login-logs?limit=300', s.admin.accessToken);
    const events = new Set(res.body.map(x => `${x.event}:${x.reason || ''}`));
    for (const e of ['LOGIN_FAILED:UNKNOWN_EMAIL', 'LOGIN_FAILED:WRONG_PASSWORD', 'LOGIN_FAILED:MISSING_FIELDS',
      'LOGIN_SUCCESS:', 'LOGOUT:', 'REFRESH_FAILED:TOKEN_NOT_CURRENT']) expect(events.has(e), e).toBe(true);
    expect((await api('get', '/login-logs', s.mahima.accessToken)).status).toBe(403);
  });

  it('registers a company and validates the body', async () => {
    const bad = await api('post', '/auth/register').send({ businessName: 'X' });
    expect(bad.status).toBe(400);
    const res = await api('post', '/auth/register').send({
      businessName: 'Glenelg Cafe', primaryContactName: 'Gina', phoneNumber: '0412000111',
      email: 'gina@glenelgcafe.com.au', password: 'Secret123!', address: '5 Jetty Rd, Glenelg SA 5045'
    });
    expect(res.status).toBe(200);
    expect((await login('gina@glenelgcafe.com.au', 'Secret123!')).accessToken).toBeTruthy();
  });
});
