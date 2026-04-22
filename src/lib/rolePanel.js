const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const config = require('../config');
const customIds = require('./customIds');
const logger = require('../logger');

let rolePanelMessageId = config.rolePanelMessageId;

function labelFromRoleKey(key) {
  return key
    .replace('role_', '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildRoleOptions() {
  return Object.keys(config.roleMap).map(key => ({
    label: labelFromRoleKey(key),
    value: key
  }));
}

function buildRoleMenu() {
  return new StringSelectMenuBuilder()
    .setCustomId(customIds.ROLE_SELECT)
    .setPlaceholder('Select your role')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(buildRoleOptions());
}

function buildRolePanelComponents() {
  return [new ActionRowBuilder().addComponents(buildRoleMenu())];
}

async function findExistingRolePanelMessage(channel, clientUserId) {
  const recentMessages = await channel.messages.fetch({ limit: 25 });
  return recentMessages.find(message =>
    message.author.id === clientUserId &&
    message.content.includes('Select your role below') &&
    message.components.length > 0
  );
}

async function setupRolePanel(client) {
  const channel = await client.channels.fetch(config.channels.rolePanel);
  if (!channel || !channel.isTextBased()) {
    logger.warn('Role panel channel is missing or is not text based', config.channels.rolePanel);
    return;
  }

  let existing = null;

  if (rolePanelMessageId) {
    try {
      existing = await channel.messages.fetch(rolePanelMessageId);
    } catch {
      existing = null;
    }
  }

  if (!existing) {
    existing = await findExistingRolePanelMessage(channel, client.user.id);
  }

  const content = '🎭 **Select your role below:**';
  const components = buildRolePanelComponents();

  if (!existing) {
    const message = await channel.send({ content, components });
    rolePanelMessageId = message.id;
    logger.info('Created role panel message', message.id);
    return;
  }

  await existing.edit({ content, components });
  rolePanelMessageId = existing.id;
  logger.info('Updated role panel message', existing.id);
}

module.exports = {
  buildRoleMenu,
  buildRoleOptions,
  buildRolePanelComponents,
  setupRolePanel
};
