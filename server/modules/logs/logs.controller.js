import * as service from './logs.service.js';

export const loginLogs = async (req, res) => res.json(await service.loginLogs(req.query));
export const auditLogs = async (req, res) => res.json(await service.auditLogs(req.query));
export const activity = async (req, res) => res.json(await service.activity(req.query));
export const activityDetail = async (req, res) => res.json(await service.activityDetail(req.params.id));
