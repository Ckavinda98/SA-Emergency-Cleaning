import { Router } from 'express';
import * as controller from './analytics.controller.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();

router.get('/analytics/summary', requireRole('ADMIN', 'CONFIG'), controller.summary);

export default router;
