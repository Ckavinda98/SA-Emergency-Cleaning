// Restrict a route to some roles, e.g. requireRole('ADMIN', 'CONFIG')
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }
  next();
};
