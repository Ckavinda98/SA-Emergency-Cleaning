import * as service from './analytics.service.js';

export const summary = async (req, res) => res.json(await service.summary());
