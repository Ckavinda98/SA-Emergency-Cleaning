// Free-hosting changes: CORS, health pings, file uploads (inline and Supabase), PDF photo reading,
// case-insensitive activity search on PostgreSQL.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { api, loginAll } from './helpers.js';
import { env } from '../../server/config/env.js';
import { prisma } from '../../server/db/prisma.js';
import { readImage, storedValue } from '../../server/lib/storage.js';

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('free hosting settings', () => {
  let s;
  beforeAll(async () => { s = await loginAll(); });

  it('answers the keep-alive and storage pings without a login', async () => {
    const health = await api('get', '/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ONLINE');
    const storage = await api('get', '/health/storage');
    expect(storage.status).toBe(200);
    expect(storage.body.driver).toBe('inline');
  });

  it('only gives CORS permission to the allowed website', async () => {
    const ok = await api('get', '/health').set('Origin', 'http://localhost:3000');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const bad = await api('get', '/health').set('Origin', 'https://evil.example.com');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('searches the activity log without caring about upper or lower case', async () => {
    await api('post', '/jobs', s.mahima.accessToken)
      .send({ organizationId: s.mahima.user.businessId, description: 'Flooded Storeroom near loading dock', onsiteContact: 'Mia Lee', onsitePhone: '0412345678', category: 'Water' });
    const lower = await api('get', '/activity?q=flooded storeroom', s.admin.accessToken);
    const upper = await api('get', '/activity?q=FLOODED STOREROOM', s.admin.accessToken);
    expect(lower.body.items.length).toBeGreaterThan(0);
    expect(upper.body.total).toBe(lower.body.total);
  });

  it('inline mode: returns the upload as a data URL and needs a login', async () => {
    expect((await api('post', '/files').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(401);
    const res = await api('post', '/files', s.mahima.accessToken).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('rejects files that are not photos, videos or PDFs', async () => {
    const res = await api('post', '/files', s.mahima.accessToken).attach('file', Buffer.from('hi'), { filename: 'a.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
  });
});

describe('Supabase storage driver (against a stand-in Supabase server)', () => {
  let s, server, base;
  const saved = new Map();
  const before = { ...env };

  beforeAll(async () => {
    s = await loginAll();
    // Minimal copy of the Supabase Storage API: upload, list, public download
    const fake = express();
    fake.post('/storage/v1/object/list/:bucket', (req, res) => res.json([...saved.keys()].slice(0, 1).map(name => ({ name }))));
    fake.post(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/, express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
      saved.set(req.params[1], { type: req.headers['content-type'], body: req.body });
      res.json({ Key: `${req.params[0]}/${req.params[1]}` });
    });
    fake.get(/^\/storage\/v1\/object\/public\/[^/]+\/(.+)$/, (req, res) => {
      const f = saved.get(req.params[0]);
      if (!f) return res.sendStatus(404);
      res.type(f.type).send(f.body);
    });
    await new Promise(r => { server = fake.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}`;
    Object.assign(env, { STORAGE_DRIVER: 'supabase', SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: 'test-key', SUPABASE_BUCKET: 'sacc-files', SUPABASE_PUBLIC_BUCKET: true });
  });
  afterAll(() => { Object.assign(env, before); server?.close(); });

  it('uploads to the bucket, records FileAttachment, links it to the new job, and the PDF can read it', async () => {
    const up = await api('post', '/files', s.mahima.accessToken).field('kind', 'photo').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.url).toMatch(new RegExp(`^${base}/storage/v1/object/public/sacc-files/uploads/`));
    expect(saved.size).toBe(1);

    const row = await prisma.fileAttachment.findUnique({ where: { id: up.body.id } });
    expect(row.kind).toBe('PHOTO');
    expect(row.organizationId).toBe(s.mahima.user.businessId);
    expect(row.jobId).toBeNull();

    const job = await api('post', '/jobs', s.mahima.accessToken)
      .send({ organizationId: s.mahima.user.businessId, description: 'Burst pipe in the kitchen', onsiteContact: 'Mia Lee', onsitePhone: '0412345678', category: 'Water', photos: [up.body.url] });
    expect(job.status).toBe(200);
    expect(job.body.photos).toEqual([up.body.url]);
    expect((await prisma.fileAttachment.findUnique({ where: { id: up.body.id } })).jobId).toBe(job.body.id);

    const img = await readImage(up.body.url);
    expect(img.type).toBe('png');
    expect(img.bytes.equals(PNG)).toBe(true);

    const health = await api('get', '/health/storage');
    expect(health.body).toMatchObject({ status: 'ONLINE', driver: 'supabase', sample: 1 });
  });

  it('saves a 1-hour private link back as its storage path', () => {
    expect(storedValue(`${base}/storage/v1/object/sign/sacc-files/uploads/x/2026-11/a.jpg?token=abc`)).toBe('storage://uploads/x/2026-11/a.jpg');
    expect(storedValue('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });
});
