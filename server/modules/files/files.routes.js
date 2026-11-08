import { Router } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { ALLOWED_TYPES } from '../../lib/storage.js';
import * as controller from './files.controller.js';

// The file is held in memory (Render has no disk) and then sent to the storage bucket
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_VIDEO_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_TYPES.includes(file.mimetype))
});

const router = Router();

// Any logged-in user: field "file", optional "kind" (photo, video, avatar, report) and "jobId"
router.post('/files', upload.single('file'), controller.upload);

export default router;
