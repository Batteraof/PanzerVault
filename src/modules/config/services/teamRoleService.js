const selectableRoleRepository = require('../../../db/repositories/selectableRoleRepository');

const TEAM_GROUP_KEY = 'team';

function optionKeyFromLabel(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

async function listTeamRoles(guildId, client) {
  return selectableRoleRepository.listActiveByGroup(guildId, TEAM_GROUP_KEY, client);
}

async function upsertTeamRole(guildId, label, roleId, sortOrder = 0) {
  const normalizedLabel = String(label || '').trim();
  const optionKey = optionKeyFromLabel(normalizedLabel || roleId);

  if (!normalizedLabel) {
    throw new Error('Team label is required.');
  }

  if (!optionKey) {
    throw new Error('Team label must contain at least one letter or number.');
  }

  if (!roleId) {
    throw new Error('Team role is required.');
  }

  return selectableRoleRepository.upsertRoleOption(
    guildId,
    TEAM_GROUP_KEY,
    optionKey,
    normalizedLabel,
    roleId,
    Number.isInteger(sortOrder) ? sortOrder : 0
  );
}

async function disableTeamRole(guildId, optionKey) {
  return selectableRoleRepository.deactivateRoleOption(guildId, TEAM_GROUP_KEY, optionKey);
}

module.exports = {
  TEAM_GROUP_KEY,
  disableTeamRole,
  listTeamRoles,
  optionKeyFromLabel,
  upsertTeamRole
};
