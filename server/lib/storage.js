// The ONLY file that knows where uploaded files live.
//   STORAGE_DRIVER=inline   -> no storage service: the file comes back as a data: URL and is kept
//                              inside the job row (how the app worked before). Good for your PC.
//   STORAGE_DRIVER=supabase -> Supabase Storage bucket (free hosting). The job keeps only the URL.
// For Azure later, add an "azure" branch to putFile / signedUrl / storageHealth. Nothing else changes.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'application/pdf': 'pdf'
};
export const ALLOWED_TYPES = Object.keys(EXT);

let client;
const supabase = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  return (client ||= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  }));
};
const bucket = () => supabase().storage.from(env.SUPABASE_BUCKET);

// uploads/<owner>/2026-11/<uuid>.jpg -- random, so a public link cannot be guessed
export const newPath = (folder, mimeType) =>
  `${folder}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${EXT[mimeType] || 'bin'}`;

// Saves the file and returns the URL the app stores in the job
export async function putFile(path, buffer, mimeType) {
  if (env.STORAGE_DRIVER === 'inline') return `data:${mimeType};base64,${buffer.toString('base64')}`;
  if (env.STORAGE_DRIVER === 'supabase') {
    const { error } = await bucket().upload(path, buffer, { contentType: mimeType, upsert: false, cacheControl: '31536000' });
    if (error) throw new Error(`File storage: ${error.message}`);
    return env.SUPABASE_PUBLIC_BUCKET ? bucket().getPublicUrl(path).data.publicUrl : `storage://${path}`;
  }
  throw new Error(`Unknown STORAGE_DRIVER "${env.STORAGE_DRIVER}". Use inline or supabase.`);
}

// A link that works for a limited time, for files in a private bucket
export async function signedUrl(path, seconds = 3600) {
  const { data, error } = await bucket().createSignedUrl(path, seconds);
  if (error) throw new Error(`File storage: ${error.message}`);
  return data.signedUrl;
}

// Turns a stored value into something a browser can open (only storage:// values change)
export async function viewUrl(value) {
  const s = String(value || '');
  if (!s.startsWith('storage://')) return s;
  try { return await signedUrl(s.slice('storage://'.length)); } catch { return ''; }
}

// Image bytes for the service report PDF. Accepts data: URLs, storage:// paths and https:// links.
export async function readImage(src) {
  const s = String(src || '');
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(s);
  if (m) return { type: m[1].toLowerCase() === 'png' ? 'png' : 'jpg', bytes: Buffer.from(m[2], 'base64') };
  const url = await viewUrl(s);
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!/image\/(png|jpe?g)/i.test(ct)) return null; // pdf-lib embeds PNG and JPEG only
    return { type: /png/i.test(ct) ? 'png' : 'jpg', bytes: Buffer.from(await res.arrayBuffer()) };
  } catch {
    return null;
  }
}

// GET /api/health/storage (daily ping)
export async function storageHealth() {
  if (env.STORAGE_DRIVER !== 'supabase') return { status: 'ONLINE', driver: env.STORAGE_DRIVER };
  const { data, error } = await bucket().list('', { limit: 1 });
  if (error) throw new Error(error.message);
  return { status: 'ONLINE', driver: 'supabase', bucket: env.SUPABASE_BUCKET, sample: data.length };
}

// The reverse of viewUrl: a 1-hour link sent back by the browser is saved as its storage:// path,
// so a private bucket never ends up with expired links in the database
export function storedValue(value) {
  const s = String(value || '');
  if (!env.SUPABASE_URL || s.startsWith('data:')) return s;
  const prefix = `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/sign/${env.SUPABASE_BUCKET}/`;
  return s.startsWith(prefix) ? `storage://${decodeURIComponent(s.slice(prefix.length).split('?')[0])}` : s;
}
export const storedList = (list) => (Array.isArray(list) ? list.map(storedValue) : list);
