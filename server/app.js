import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authGate } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import configRoutes from './modules/config/config.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import jobRoutes from './modules/jobs/jobs.routes.js';
import technicianRoutes from './modules/technicians/technicians.routes.js';
import redemptionRoutes from './modules/redemptions/redemptions.routes.js';
import invoiceRoutes from './modules/invoices/invoices.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import logRoutes from './modules/logs/logs.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import fileRoutes from './modules/files/files.routes.js';
import { storageHealth } from './lib/storage.js';

// Builds the Express app without starting it, so tests can use it directly
export function createApp() {
  const app = express();

  // Render (and Azure App Service) put one proxy in front of the API. Trusting it makes req.ip the
  // real visitor, which the login rate limit needs (otherwise everyone shares the proxy's address).
  app.set('trust proxy', 1);

  // Only the web app's own address (CORS_ORIGIN) may call the API from a browser.
  // Requests with no Origin (curl, cron-job.org, server-to-server) are allowed through.
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGIN.includes(origin)),
    maxAge: 86400 // browsers cache the pre-flight check for a day
  }));
  app.use(express.json({ limit: env.JSON_LIMIT }));
  app.use(express.urlencoded({ limit: env.JSON_LIMIT, extended: true }));

  // Slow down password guessing: LOGIN_LIMIT_PER_15_MIN sign-in attempts per 15 minutes per IP address
  app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.LOGIN_LIMIT_PER_15_MIN,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }
  }));

  // Every /api route needs a login except the public list in middleware/authenticate.js
  app.use('/api', authGate);

  // Keep-alive ping (cron-job.org every 10 minutes). It must NOT touch the database, so Neon can sleep.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ONLINE', storage: env.STORAGE_DRIVER, timestamp: new Date() });
  });
  // Daily ping: lists one file in the bucket, which keeps the Supabase project from pausing
  app.get('/api/health/storage', async (req, res) => {
    try { res.json(await storageHealth()); }
    catch (e) { res.status(503).json({ status: 'STORAGE_ERROR', error: e.message }); }
  });

  for (const routes of [authRoutes, configRoutes, customerRoutes, reportRoutes, jobRoutes, technicianRoutes,
    redemptionRoutes, invoiceRoutes, analyticsRoutes, logRoutes, searchRoutes, fileRoutes]) {
    app.use('/api', routes);
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
