import * as service from './config.service.js';
import { actorOf } from '../../lib/request.js';

export const get = async (req, res) => res.json(await service.getConfig());
export const update = async (req, res) => res.json(await service.updateConfig(actorOf(req), req.body));
