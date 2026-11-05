import { Router } from 'express';
import * as controller from './invoices.controller.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();

router.get('/customers/:id/invoices', requireRole('CUSTOMER', 'ADMIN'), controller.list);
router.post('/customers/:id/invoices', requireRole('ADMIN'), controller.create);

export default router;
