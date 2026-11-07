import * as service from './search.service.js';
import { actorOf } from '../../lib/request.js';

export const search = async (req, res) => res.json(await service.search(actorOf(req), req.query.q));
