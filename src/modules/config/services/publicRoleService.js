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

function emojiIdentifier(value) {
  const normalized = String(value || '').trim();
  const customMatch = normalized.match(/^<a?:[^:]+:(\d+)>$/);
  return customMatch ? customMatch[1] : normalized;
}

async function upsertPublicRole(guildId, label, roleId, emoji, sortOrder = 0) {
  const normalizedLabel = String(label || '').trim();
  const normalizedEmoji = String(emoji || '').trim();
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

  if (!normalizedEmoji) {
    throw new Error('Emoji is required.');
  }

  return selectableRoleRepository.upsertRoleOptionWithEmoji(
    guildId,
    PUBLIC_GROUP_KEY,
    optionKey,
    normalizedLabel,
    roleId,
    Number.isInteger(sortOrder) ? sortOrder : 0,
    normalizedEmoji
  );
}

async function disablePublicRole(guildId, optionKey) {
  return selectableRoleRepository.deactivateRoleOption(guildId, PUBLIC_GROUP_KEY, optionKey);
}

module.exports = {
  PUBLIC_GROUP_KEY,
  disablePublicRole,
  emojiIdentifier,
  listPublicRoles,
  optionKeyFromLabel,
  upsertPublicRole
};
