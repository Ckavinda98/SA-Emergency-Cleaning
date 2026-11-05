import { Router } from 'express';
import * as controller from './config.controller.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { configSchema } from '../../../shared/schemas.js';

const router = Router();

router.get('/config', controller.get);
router.put('/config', requireRole('ADMIN', 'CONFIG'), validate(configSchema), controller.update);

export default router;
