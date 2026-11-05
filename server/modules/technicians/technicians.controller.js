import * as service from './technicians.service.js';
import { actorOf } from '../../lib/request.js';

export const list = async (req, res) => res.json(await service.list());
export const create = async (req, res) => res.json(await service.create(actorOf(req), req.body));
export const update = async (req, res) => res.json(await service.update(actorOf(req), req.params.id, req.body));
export const updateProfile = async (req, res) => res.json(await service.updateProfile(actorOf(req), req.params.id, req.body));
export const setStatus = async (req, res) => res.json(await service.setStatus(actorOf(req), req.params.id, req.body));
export const remove = async (req, res) => res.json(await service.remove(actorOf(req), req.params.id));
