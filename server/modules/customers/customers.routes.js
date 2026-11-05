import { Router } from 'express';
import * as controller from './customers.controller.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { customerCreateSchema, profileSchema, planSchema, siteCreateSchema } from '../../../shared/schemas.js';

const router = Router();
const customerOrAdmin = requireRole('CUSTOMER', 'ADMIN');

router.get('/customers', controller.list);
router.post('/customers', requireRole('ADMIN'), validate(customerCreateSchema), controller.create);
router.get('/customers/:id', controller.get);
router.put('/customers/:id/profile', customerOrAdmin, validate(profileSchema), controller.updateProfile);
router.put('/customers/:id/plan', customerOrAdmin, validate(planSchema), controller.changePlan);
router.post('/customers/:id/cancel-subscription', customerOrAdmin, controller.cancelSubscription);
router.delete('/customers/:id', customerOrAdmin, controller.remove);

// Sites (locations) of a company
router.post('/customers/:id/locations', customerOrAdmin, validate(siteCreateSchema), controller.addSite);
router.put('/locations/:id', customerOrAdmin, controller.updateSite);

export default router;
