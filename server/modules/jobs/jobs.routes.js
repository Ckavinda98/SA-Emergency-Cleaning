import { Router } from 'express';
import * as controller from './jobs.controller.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { jobCreateSchema, jobStatusSchema } from '../../../shared/schemas.js';

const router = Router();

router.get('/jobs', controller.list);
router.post('/jobs', requireRole('CUSTOMER', 'ADMIN'), validate(jobCreateSchema), controller.create);
router.delete('/jobs/reset-all', requireRole('ADMIN'), controller.resetAll);
router.get('/jobs/:id', controller.get);
router.put('/jobs/:id', requireRole('CUSTOMER', 'ADMIN'), controller.edit);
router.patch('/jobs/:id/status', requireRole('ADMIN', 'TECHNICIAN'), validate(jobStatusSchema), controller.changeStatus);
router.post('/jobs/:id/extension', requireRole('ADMIN', 'TECHNICIAN'), controller.updateExtension);

export default router;
