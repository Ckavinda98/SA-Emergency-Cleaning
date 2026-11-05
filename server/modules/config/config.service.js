import { prisma } from '../../db/prisma.js';
import { recordAudit } from '../../lib/audit.js';
import { DEFAULT_CONFIG } from '../../../shared/config.js';

const KEY = 'MAIN_CONFIG';

// The live business configuration, or the defaults when nothing has been saved yet
export async function getConfig() {
  const record = await prisma.systemDynamicConfig.findUnique({ where: { configKey: KEY } });
  return record ? JSON.parse(record.configValue) : DEFAULT_CONFIG;
}

export async function updateConfig(actor, updatedConfig) {
  const existing = await prisma.systemDynamicConfig.findUnique({ where: { configKey: KEY } });
  await prisma.systemDynamicConfig.upsert({
    where: { configKey: KEY },
    update: { configValue: JSON.stringify(updatedConfig) },
    create: { configKey: KEY, configValue: JSON.stringify(updatedConfig) }
  });
  await recordAudit(actor, {
    action: 'CONFIG_UPDATED',
    entityType: 'SystemDynamicConfig',
    entityId: KEY,
    diff: { before: existing ? JSON.parse(existing.configValue) : DEFAULT_CONFIG, after: updatedConfig }
  });
  return { message: 'Dynamic Configuration updated in Database successfully', config: updatedConfig };
}
