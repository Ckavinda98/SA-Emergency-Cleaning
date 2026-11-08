import { actorOf } from '../../lib/request.js';
import * as service from './files.service.js';

export const upload = async (req, res) => res.status(201).json(await service.upload(actorOf(req), req.file, req.body));
