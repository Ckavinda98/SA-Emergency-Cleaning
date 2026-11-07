import * as service from './analytics.service.js';
import { actorOf } from '../../lib/request.js';

export const summary = async (req, res) => res.json(await service.summary());
export const housekeeping = async (req, res) => res.json(await service.housekeeping(actorOf(req)));
