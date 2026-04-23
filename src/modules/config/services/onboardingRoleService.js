const config = require('../../../config');
const selectableRoleRepository = require('../../../db/repositories/selectableRoleRepository');

const SKILL_OPTIONS = [
  { key: 'beginner', label: 'Beginner', roleMapKey: 'role_beginner', sortOrder: 10 },
  { key: 'medium', label: 'Medium', roleMapKey: 'role_medium', sortOrder: 20 },
  { key: 'expert', label: 'Expert', roleMapKey: 'role_expert', sortOrder: 30 }
];

const REGION_OPTIONS = [
  { key: 'eu', label: config.regionRoleLabels.eu, sortOrder: 10 },
  { key: 'uk', label: config.regionRoleLabels.uk, sortOrder: 20 },
  { key: 'na', label: config.regionRoleLabels.na, sortOrder: 30 },
  { key: 'latam', label: config.regionRoleLabels.latam, sortOrder: 40 },
  { key: 'africa', label: config.regionRoleLabels.africa, sortOrder: 50 },
  { key: 'sa', label: config.regionRoleLabels.sa, sortOrder: 60 },
  { key: 'ea', label: config.regionRoleLabels.ea, sortOrder: 70 },
  { key: 'sea', label: config.regionRoleLabels.sea, sortOrder: 80 },
  { key: 'oce', label: config.regionRoleLabels.oce, sortOrder: 90 }
];

async function ensureDefaults(guildId, client) {
  for (const option of SKILL_OPTIONS) {
    const roleId = config.roleMap[option.roleMapKey];
    if (!roleId) continue;

    await selectableRoleRepository.upsertRoleOption(
      guildId,
      'skill',
      option.key,
      option.label,
      roleId,
      option.sortOrder,
      client
    );
  }

  for (const option of REGION_OPTIONS) {
    const roleId = config.regionRoleMap[option.key];
    if (!roleId) continue;

    await selectableRoleRepository.upsertRoleOption(
      guildId,
      'region',
      option.key,
      option.label,
      roleId,
      option.sortOrder,
      client
    );
  }
}

async function listRolesByGroup(guildId, groupKey, client) {
  await ensureDefaults(guildId, client);
  return selectableRoleRepository.listActiveByGroup(guildId, groupKey, client);
}

async function setSkillRole(guildId, key, roleId) {
  const option = SKILL_OPTIONS.find(item => item.key === key);
  if (!option) {
    throw new Error(`Unknown skill role key: ${key}`);
  }

  return selectableRoleRepository.upsertRoleOption(
    guildId,
    'skill',
    key,
    option.label,
    roleId,
    option.sortOrder
  );
}

async function setRegionRole(guildId, key, roleId) {
  const option = REGION_OPTIONS.find(item => item.key === key);
  if (!option) {
    throw new Error(`Unknown region role key: ${key}`);
  }

  return selectableRoleRepository.upsertRoleOption(
    guildId,
    'region',
    key,
    roleId ? option.label : option.label,
    roleId,
    option.sortOrder
  );
}

async function disableRegionRole(guildId, key) {
  return selectableRoleRepository.deactivateRoleOption(guildId, 'region', key);
}

module.exports = {
  SKILL_OPTIONS,
  REGION_OPTIONS,
  ensureDefaults,
  listRolesByGroup,
  setSkillRole,
  setRegionRole,
  disableRegionRole
};
