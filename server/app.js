import express from 'express';
import cors from 'cors';
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

// Builds the Express app without starting it, so tests can use it directly
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: env.JSON_LIMIT }));
  app.use(express.urlencoded({ limit: env.JSON_LIMIT, extended: true }));

  // Every /api route needs a login except the public list in middleware/authenticate.js
  app.use('/api', authGate);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ONLINE', database: 'Prisma SQLite/PostgreSQL Connected', timestamp: new Date() });
  });

  for (const routes of [authRoutes, configRoutes, customerRoutes, reportRoutes, jobRoutes, technicianRoutes,
    redemptionRoutes, invoiceRoutes, analyticsRoutes, logRoutes]) {
    app.use('/api', routes);
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
