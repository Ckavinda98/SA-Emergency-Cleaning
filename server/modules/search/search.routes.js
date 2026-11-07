import { Router } from 'express';
import * as controller from './search.controller.js';

const router = Router();

// Any signed-in user; results are limited to what their role may see (see search.service.js)
router.get('/search', controller.search);

export default router;
