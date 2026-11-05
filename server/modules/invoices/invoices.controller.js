import * as service from './invoices.service.js';
import { actorOf } from '../../lib/request.js';

export const list = async (req, res) => res.json(await service.list(actorOf(req), req.params.id));
export const create = async (req, res) => res.json(await service.create(actorOf(req), req.params.id, req.body));
