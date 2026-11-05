import * as service from './auth.service.js';
import { actorOf } from '../../lib/request.js';

export const register = async (req, res) => res.json(await service.register(actorOf(req), req.body));
export const login = async (req, res) => res.json(await service.login(actorOf(req), req.body));
export const logout = async (req, res) => res.json(await service.logout(actorOf(req)));
export const refresh = async (req, res) => res.json(await service.refresh(actorOf(req), req.body));
