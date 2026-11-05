import { Router } from 'express';
import * as controller from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema } from '../../../shared/schemas.js';

const router = Router();

router.post('/auth/register', validate(registerSchema), controller.register);
router.post('/auth/login', controller.login);
router.post('/auth/logout', controller.logout);
router.post('/auth/refresh', controller.refresh);

export default router;
