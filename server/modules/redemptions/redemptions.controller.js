import * as service from './redemptions.service.js';
import { actorOf } from '../../lib/request.js';

export const list = async (req, res) => res.json(await service.list(actorOf(req)));
export const create = async (req, res) => res.json(await service.create(actorOf(req), req.body));
export const decide = async (req, res) => res.json(await service.decide(actorOf(req), req.params.id, req.body.status));
