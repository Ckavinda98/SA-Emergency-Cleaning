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
