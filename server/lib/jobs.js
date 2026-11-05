// Jobs store photos and videos as JSON text; the API always returns them as arrays
export const parseJob = (job) => ({
  ...job,
  photos: JSON.parse(job.photosJson || '[]'),
  videos: JSON.parse(job.videosJson || '[]')
});
