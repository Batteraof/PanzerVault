const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const config = require('../config');
const customIds = require('./customIds');
const communitySettingsService = require('../modules/config/services/communitySettingsService');
const onboardingRoleService = require('../modules/config/services/onboardingRoleService');
const logger = require('../logger');

let rolePanelMessageId = config.rolePanelMessageId;

function buildSelectMenu(customId, placeholder, options) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      options.map(option => ({
        label: option.label,
        value: option.option_key || option.key
      }))
    );
}

async function buildRolePanelData(guildId) {
  const [communitySettings, skillRoles, regionRoles] = await Promise.all([
    communitySettingsService.ensureGuildSettings(guildId),
    onboardingRoleService.listRolesByGroup(guildId, 'skill'),
    onboardingRoleService.listRolesByGroup(guildId, 'region')
  ]);

  return {
    communitySettings,
    skillRoles,
    regionRoles
  };
}

async function buildRolePanelComponents(guildId) {
  const data = await buildRolePanelData(guildId);
  const components = [];

  if (data.skillRoles.length > 0) {
    components.push(
      new ActionRowBuilder().addComponents(
        buildSelectMenu(customIds.SKILL_SELECT, 'Choose your skill level', data.skillRoles)
      )
    );
  }

  if (data.regionRoles.length > 0) {
    components.push(
      new ActionRowBuilder().addComponents(
        buildSelectMenu(customIds.REGION_SELECT, 'Choose your region', data.regionRoles)
      )
    );
  }

  if (data.communitySettings.coach_role_id) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customIds.COACH_TOGGLE)
          .setLabel('Toggle Coach Role')
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return components;
}

function buildRolePanelContent(data) {
  const lines = ['Pick the roles that fit you best.'];

  if (data.skillRoles.length > 0) {
    lines.push('- Pick your skill level: Beginner, Medium, or Expert.');
  }

  if (data.regionRoles.length > 0) {
    lines.push('- Pick the region that fits you best.');
  }

  if (data.communitySettings.coach_role_id) {
    lines.push('- Medium and Expert players can opt into the coach role so beginners know who to ping for help.');
    lines.push(`- Beginners: if you need help, watch for members with <@&${data.communitySettings.coach_role_id}>.`);
  }

  return lines.join('\n');
}

async function findExistingRolePanelMessage(channel, clientUserId) {
  const recentMessages = await channel.messages.fetch({ limit: 25 });
  return recentMessages.find(message =>
    message.author.id === clientUserId &&
    message.content.includes('Select your onboarding roles below') &&
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

  const data = await buildRolePanelData(channel.guild.id);
  const content = `**Select your onboarding roles below:**\n${buildRolePanelContent(data)}`;
  const components = await buildRolePanelComponents(channel.guild.id);

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
  buildRolePanelComponents,
  buildRolePanelContent,
  buildRolePanelData,
  setupRolePanel
};
