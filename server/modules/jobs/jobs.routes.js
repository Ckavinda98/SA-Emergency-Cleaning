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
// Agreement and Operations SOP steps
router.post('/jobs/:id/acknowledge', requireRole('ADMIN'), controller.acknowledge);
router.post('/jobs/:id/triage', requireRole('ADMIN'), controller.triage);
router.post('/jobs/:id/quote', requireRole('CUSTOMER', 'ADMIN'), controller.decideQuote);
router.post('/jobs/:id/cancel', requireRole('CUSTOMER', 'ADMIN'), controller.cancel);
router.patch('/jobs/:id/site', requireRole('ADMIN', 'TECHNICIAN'), controller.updateSiteRecord);
router.post('/jobs/:id/reclassify', requireRole('ADMIN', 'TECHNICIAN'), controller.reclassify);
router.post('/jobs/:id/missed-access', requireRole('ADMIN', 'TECHNICIAN'), controller.missedAccess);
router.post('/jobs/:id/report', requireRole('ADMIN'), controller.issueReport);
router.post('/jobs/:id/goodwill', requireRole('ADMIN'), controller.goodwill);
router.post('/jobs/:id/reattend', requireRole('CUSTOMER', 'ADMIN'), controller.reattend);

export default router;
