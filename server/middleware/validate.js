// Runs a Zod schema on req.body. On failure: 400 with the first rule's message, plus
// `fields` ({ field: message }) so forms can show each message under its own field.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path?.[0];
      if (key !== undefined && !fields[key]) fields[key] = issue.message;
    }
    return res.status(400).json({ error: result.error.issues[0]?.message || 'Invalid request.', fields });
  }
  req.body = result.data;
  next();
};
