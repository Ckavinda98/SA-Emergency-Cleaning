import { Router } from 'express';
import * as controller from './reports.controller.js';

const router = Router();

// Public in the auth gate: checks its own ?token= instead
router.get('/jobs/:id/pdf-report', controller.serviceReport);
router.get('/jobs/:id/report.pdf', controller.serviceReportPdf);

export default router;
