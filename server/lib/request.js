// Small helpers about the incoming request
export const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || null;

// Who made the request and from where: passed from controllers into services for logging
export const actorOf = (req) => ({
  userId: req.user?.userId || null,
  email: req.user?.email || null,
  role: req.user?.role || null,
  organizationId: req.user?.organizationId || null,
  technicianId: req.user?.technicianId || null,
  ip: clientIp(req),
  userAgent: req.headers['user-agent'] || null
});
