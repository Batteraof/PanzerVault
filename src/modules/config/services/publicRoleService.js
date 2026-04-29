const selectableRoleRepository = require('../../../db/repositories/selectableRoleRepository');

const PUBLIC_GROUP_KEY = 'public';

function optionKeyFromLabel(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

async function listPublicRoles(guildId, client) {
  return selectableRoleRepository.listActiveByGroup(guildId, PUBLIC_GROUP_KEY, client);
}

async function upsertPublicRole(guildId, label, roleId, sortOrder = 0) {
  const normalizedLabel = String(label || '').trim();
  const optionKey = optionKeyFromLabel(normalizedLabel || roleId);

  if (!normalizedLabel) {
    throw new Error('Role label is required.');
  }

  if (!optionKey) {
    throw new Error('Role label must contain at least one letter or number.');
  }

  if (!roleId) {
    throw new Error('Discord role is required.');
  }

  return selectableRoleRepository.upsertRoleOption(
    guildId,
    PUBLIC_GROUP_KEY,
    optionKey,
    normalizedLabel,
    roleId,
    Number.isInteger(sortOrder) ? sortOrder : 0
  );
}

async function disablePublicRole(guildId, optionKey) {
  return selectableRoleRepository.deactivateRoleOption(guildId, PUBLIC_GROUP_KEY, optionKey);
}

module.exports = {
  PUBLIC_GROUP_KEY,
  disablePublicRole,
  listPublicRoles,
  optionKeyFromLabel,
  upsertPublicRole
};
