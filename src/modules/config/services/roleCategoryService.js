const roleCategoryRepository = require('../../../db/repositories/roleCategoryRepository');
const selectableRoleRepository = require('../../../db/repositories/selectableRoleRepository');
const onboardingRoleService = require('./onboardingRoleService');

const DEFAULT_CATEGORIES = [
  {
    categoryKey: 'skill',
    commandName: 'skill',
    label: 'Skill Level',
    description: 'Choose your current experience level.',
    selectionMode: 'single',
    sortOrder: 10
  },
  {
    categoryKey: 'region',
    commandName: 'region',
    label: 'Region',
    description: 'Choose your usual play region.',
    selectionMode: 'single',
    sortOrder: 20
  },
  {
    categoryKey: 'team',
    commandName: 'team',
    label: 'Team',
    description: 'Choose your team role.',
    selectionMode: 'single',
    sortOrder: 30
  }
];

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function normalizeCommandName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

async function ensureDefaults(guildId, client) {
  await onboardingRoleService.ensureDefaults(guildId, client);

  for (const category of DEFAULT_CATEGORIES) {
    await roleCategoryRepository.upsertCategory(guildId, {
      ...category,
      isEnabled: true
    }, client);
  }
}

async function listCategories(guildId, options = {}, client) {
  await ensureDefaults(guildId, client);
  return options.includeDisabled
    ? roleCategoryRepository.listAll(guildId, client)
    : roleCategoryRepository.listEnabled(guildId, client);
}

async function findByCommandName(guildId, commandName, client) {
  await ensureDefaults(guildId, client);
  return roleCategoryRepository.findByCommandName(guildId, commandName, client);
}

async function upsertCategory(guildId, input) {
  const label = String(input.label || '').trim();
  const categoryKey = normalizeKey(input.categoryKey || label);
  const commandName = normalizeCommandName(input.commandName || categoryKey);
  const selectionMode = input.selectionMode === 'multiple' ? 'multiple' : 'single';

  if (!label) throw new Error('Category label is required.');
  if (!categoryKey) throw new Error('Category key must contain at least one letter or number.');
  if (!commandName) throw new Error('Command name must contain at least one letter or number.');

  return roleCategoryRepository.upsertCategory(guildId, {
    categoryKey,
    commandName,
    label,
    description: String(input.description || '').trim() || null,
    selectionMode,
    isEnabled: input.isEnabled !== false,
    sortOrder: Number.parseInt(input.sortOrder, 10) || 0
  });
}

async function setCategoryEnabled(guildId, categoryKey, isEnabled) {
  return roleCategoryRepository.setEnabled(guildId, categoryKey, isEnabled);
}

async function listCategoryOptions(guildId, categoryKey, client) {
  return selectableRoleRepository.listActiveByGroup(guildId, categoryKey, client);
}

async function upsertCategoryOption(guildId, categoryKey, input) {
  const label = String(input.label || '').trim();
  const optionKey = normalizeKey(input.optionKey || label || input.roleId);

  if (!label) throw new Error('Role option label is required.');
  if (!optionKey) throw new Error('Role option key must contain at least one letter or number.');
  if (!input.roleId) throw new Error('Role option needs a Discord role.');

  return selectableRoleRepository.upsertRoleOption(
    guildId,
    categoryKey,
    optionKey,
    label,
    input.roleId,
    Number.parseInt(input.sortOrder, 10) || 0
  );
}

async function disableCategoryOption(guildId, categoryKey, optionKey) {
  return selectableRoleRepository.deactivateRoleOption(guildId, categoryKey, optionKey);
}

module.exports = {
  DEFAULT_CATEGORIES,
  disableCategoryOption,
  ensureDefaults,
  findByCommandName,
  listCategories,
  listCategoryOptions,
  normalizeCommandName,
  normalizeKey,
  setCategoryEnabled,
  upsertCategory,
  upsertCategoryOption
};
