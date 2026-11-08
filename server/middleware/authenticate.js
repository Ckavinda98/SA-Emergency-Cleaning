import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Checks the Bearer access token and puts its payload on req.user
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required.' });

  jwt.verify(token, env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'TokenExpiredError' });
      }
      return res.status(403).json({ error: 'Invalid or expired access token.' });
    }
    req.user = user;
    next();
  });
};

// Every /api route needs a valid login except these.
// The PDF report checks its own token (passed as ?token=) because it opens in a new browser tab.
export const PUBLIC_ROUTES = [
  ['GET', /^\/api\/health$/],
  ['GET', /^\/api\/config$/],
  ['POST', /^\/api\/auth\/(register|login|refresh)$/],
  ['GET', /^\/api\/jobs\/[^/]+\/pdf-report$/],
  ['GET', /^\/api\/jobs\/[^/]+\/report\.pdf$/]
];

export const authGate = (req, res, next) => {
  const path = req.originalUrl.split('?')[0];
  const isPublic = PUBLIC_ROUTES.some(([method, pattern]) => method === req.method && pattern.test(path));
  if (isPublic) return next();
  authenticateToken(req, res, next);
};
