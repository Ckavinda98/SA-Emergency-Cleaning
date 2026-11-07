import { Router } from 'express';
import * as controller from './logs.controller.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();

// Login history and change history (Admin and Config)
router.get('/login-logs', requireRole('ADMIN', 'CONFIG'), controller.loginLogs);
router.get('/audit-logs', requireRole('ADMIN', 'CONFIG'), controller.auditLogs);

// Readable activity log: who did what, when, and every field before and after
router.get('/activity', requireRole('ADMIN', 'CONFIG'), controller.activity);
router.get('/activity/:id', requireRole('ADMIN', 'CONFIG'), controller.activityDetail);

export default router;
