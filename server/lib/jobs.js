import { viewUrl } from './storage.js';

// Jobs store lists as JSON text; the API always returns them as arrays / objects
const list = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } };
const obj = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

export const parseJob = (job) => ({
  ...job,
  photos: list(job.photosJson),
  videos: list(job.videosJson),
  hazards: list(job.hazardsJson),
  coverageWarnings: list(job.coverageWarningsJson),
  beforePhotos: list(job.beforePhotosJson),
  afterPhotos: list(job.afterPhotosJson),
  disposal: list(job.disposalJson),
  checklist: obj(job.checklistJson) || {},
  missedAccess: obj(job.missedAccessJson)
});

// Private bucket only: swaps storage:// paths for 1-hour links. Public links and data: URLs stay as they are.
const viewList = (list) => Promise.all((list || []).map(viewUrl));
export async function withMediaLinks(job) {
  const media = [job.photos, job.videos, job.beforePhotos, job.afterPhotos];
  if (!media.flat().some(u => String(u).startsWith('storage://')) && !String(job.missedAccess?.entrancePhoto || '').startsWith('storage://')) return job;
  const [photos, videos, beforePhotos, afterPhotos] = await Promise.all(media.map(viewList));
  const missedAccess = job.missedAccess ? { ...job.missedAccess, entrancePhoto: await viewUrl(job.missedAccess.entrancePhoto) } : job.missedAccess;
  return { ...job, photos, videos, beforePhotos, afterPhotos, missedAccess };
}
