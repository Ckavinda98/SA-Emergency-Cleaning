// Runs a Zod schema on req.body. On failure: 400 with the first rule's message.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0]?.message || 'Invalid request.' });
  }
  req.body = result.data;
  next();
};
