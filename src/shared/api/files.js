// File uploads. Each photo or video goes to POST /api/files on its own; the job only keeps the URL
// that comes back. With STORAGE_DRIVER=supabase that is a link to the Supabase bucket, so photos no
// longer travel inside every job list. With STORAGE_DRIVER=inline (your PC) it is a data: URL as before.
import { API_BASE } from '@/shared/config/env.js';

// Phone photos are large: shrink to at most 1600 px as an 80% JPEG before sending
export function shrinkToBlob(file, max = 1600, quality = 0.8) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif') return Promise.resolve(file);
  return new Promise((resolve) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onerror = () => { URL.revokeObjectURL(src); resolve(file); };
    img.onload = () => {
      URL.revokeObjectURL(src);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => resolve(b || file), 'image/jpeg', quality);
    };
    img.src = src;
  });
}

// Sends one file and returns the URL to keep in the job. The fetch wrapper (client.js) adds the login
// token. Do not set Content-Type: the browser sets it, with the boundary, for FormData.
export async function uploadFile(file, kind = 'photo', jobId) {
  const blob = await shrinkToBlob(file);
  const form = new FormData();
  const name = blob === file ? (file.name || `${kind}`) : `${(file.name || 'photo').replace(/\.[^.]+$/, '')}.jpg`;
  form.append('kind', kind);
  if (jobId) form.append('jobId', jobId);
  form.append('file', blob, name);
  let res;
  try {
    res = await fetch(`${API_BASE}/files`, { method: 'POST', body: form });
  } catch {
    throw new Error('Cannot reach the server. The file was not uploaded.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'The file could not be uploaded.');
  return data.url;
}
