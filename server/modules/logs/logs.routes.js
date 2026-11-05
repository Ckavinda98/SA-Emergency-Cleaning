import { Router } from 'express';
import * as controller from './logs.controller.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();

// Login history and change history (Admin only)
router.get('/login-logs', requireRole('ADMIN'), controller.loginLogs);
router.get('/audit-logs', requireRole('ADMIN'), controller.auditLogs);

export default router;
