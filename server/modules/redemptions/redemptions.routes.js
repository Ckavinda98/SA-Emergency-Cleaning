import { Router } from 'express';
import * as controller from './redemptions.controller.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { redemptionCreateSchema, redemptionDecisionSchema } from '../../../shared/schemas.js';

const router = Router();

router.get('/redemptions', requireRole('CUSTOMER', 'ADMIN'), controller.list);
router.post('/redemptions', requireRole('CUSTOMER', 'ADMIN'), validate(redemptionCreateSchema), controller.create);
router.patch('/redemptions/:id/status', requireRole('CUSTOMER', 'ADMIN'), validate(redemptionDecisionSchema), controller.decide);

export default router;
