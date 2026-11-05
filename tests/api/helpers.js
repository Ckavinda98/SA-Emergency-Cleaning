import request from 'supertest';
import { createApp } from '../../server/app.js';

export const app = createApp();
export const PASSWORD = 'Password123!';

export const api = (method, path, token) => {
  const req = request(app)[method](`/api${path}`);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

export async function login(email, password = PASSWORD) {
  const res = await api('post', '/auth/login').send({ email, password });
  return res.body;
}

export const USERS = {
  admin: 'admin@sacleaning.com.au',
  config: 'config@sacleaning.com.au',
  mahima: 'mahima@mahimaenterprises.com.au',
  ross: 'dross@adelaidetower.com.au',
  dave: 'dave@sacleaning.com.au',
  chris: 'chris@sacleaning.com.au'
};

export async function loginAll() {
  const out = {};
  for (const [key, email] of Object.entries(USERS)) out[key] = await login(email);
  return out;
}
