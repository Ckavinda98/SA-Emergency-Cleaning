import * as service from './customers.service.js';
import { actorOf } from '../../lib/request.js';

export const list = async (req, res) => res.json(await service.list(actorOf(req)));
export const get = async (req, res) => res.json(await service.get(actorOf(req), req.params.id));
export const create = async (req, res) => res.json(await service.create(actorOf(req), req.body));
export const updateProfile = async (req, res) => res.json(await service.updateProfile(actorOf(req), req.params.id, req.body));
export const changePlan = async (req, res) => res.json(await service.changePlan(actorOf(req), req.params.id, req.body.membershipPlan));
export const cancelSubscription = async (req, res) => res.json(await service.cancelSubscription(actorOf(req), req.params.id));
export const remove = async (req, res) => res.json(await service.remove(actorOf(req), req.params.id));
export const addSite = async (req, res) => res.json(await service.addSite(actorOf(req), req.params.id, req.body));
export const updateSite = async (req, res) => res.json(await service.updateSite(actorOf(req), req.params.id, req.body));
