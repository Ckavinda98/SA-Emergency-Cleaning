import * as service from './jobs.service.js';
import { actorOf } from '../../lib/request.js';

export const list = async (req, res) => res.json(await service.list(actorOf(req)));
export const get = async (req, res) => res.json(await service.get(actorOf(req), req.params.id));
export const create = async (req, res) => res.json(await service.create(actorOf(req), req.body));
export const edit = async (req, res) => res.json(await service.edit(actorOf(req), req.params.id, req.body));
export const changeStatus = async (req, res) => res.json(await service.changeStatus(actorOf(req), req.params.id, req.body));
export const resetAll = async (req, res) => res.json(await service.resetAll(actorOf(req)));
export const updateExtension = async (req, res) => res.json(await service.updateExtension(actorOf(req), req.params.id, req.body));
