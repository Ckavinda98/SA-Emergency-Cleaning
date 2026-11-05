// One place that turns errors into JSON responses.
// Services throw HttpError(status, message); anything else is a 500.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  const status = err?.status && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err?.message || 'Unexpected server error.' });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl.split('?')[0]}` });
};
