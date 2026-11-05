import { Router } from 'express';
import * as controller from './technicians.controller.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { technicianCreateSchema, technicianStatusSchema, technicianProfileSchema } from '../../../shared/schemas.js';

const router = Router();

router.get('/technicians', requireRole('ADMIN', 'TECHNICIAN', 'CONFIG'), controller.list);
router.post('/technicians', requireRole('ADMIN'), validate(technicianCreateSchema), controller.create);
router.put('/technicians/:id', requireRole('ADMIN'), controller.update);
router.put('/technicians/:id/profile', requireRole('ADMIN', 'TECHNICIAN'), validate(technicianProfileSchema), controller.updateProfile);
router.patch('/technicians/:id/status', requireRole('ADMIN', 'TECHNICIAN'), validate(technicianStatusSchema), controller.setStatus);
router.delete('/technicians/:id', requireRole('ADMIN'), controller.remove);

export default router;
