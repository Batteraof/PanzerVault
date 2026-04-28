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
  const botOnboardingEnabled = data.communitySettings.onboarding_enabled !== false;

  if (botOnboardingEnabled && data.skillRoles.length > 0) {
    components.push(
      new ActionRowBuilder().addComponents(
        buildSelectMenu(customIds.SKILL_SELECT, 'Choose your skill level', data.skillRoles)
      )
    );
  }

  if (botOnboardingEnabled && data.regionRoles.length > 0) {
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
          .setLabel('Toggle Helper Role')
          .setStyle(ButtonStyle.Primary)
      )
    );
  }

  return components;
}

function buildRolePanelContent(data) {
  const botOnboardingEnabled = data.communitySettings.onboarding_enabled !== false;
  const lines = botOnboardingEnabled
    ? ['Pick the roles that fit you best.']
    : ['Discord Onboarding handles your platform, region, skill, and channel roles.'];

  if (botOnboardingEnabled && data.skillRoles.length > 0) {
    lines.push('- Pick your skill level: Beginner, Medium, or Expert.');
  }

  if (botOnboardingEnabled && data.regionRoles.length > 0) {
    lines.push('- Pick the region that fits you best.');
  }

  if (data.communitySettings.coach_role_id) {
    lines.push('- Medium and Expert players can opt into the helper role so beginners know who to ask for help.');
    lines.push(`- Beginners can watch for members with <@&${data.communitySettings.coach_role_id}>.`);
  }

  if (!botOnboardingEnabled) {
    lines.push('- The bot still manages XP rewards, tickets, media flows, events, and admin tools.');
  }

  return lines.join('\n');
}

async function findExistingRolePanelMessage(channel, clientUserId) {
  const recentMessages = await channel.messages.fetch({ limit: 25 });
  return recentMessages.find(message =>
    message.author.id === clientUserId &&
    (
      message.content.includes('Select your onboarding roles below') ||
      message.content.includes('Discord Onboarding handles your platform') ||
      message.content.includes('**Role setup:**')
    ) &&
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
  const botOnboardingEnabled = data.communitySettings.onboarding_enabled !== false;
  const title = botOnboardingEnabled ? 'Select your onboarding roles below' : 'Role setup';
  const content = `**${title}:**\n${buildRolePanelContent(data)}`;
  const components = await buildRolePanelComponents(channel.guild.id);

  if (!existing && components.length === 0) {
    logger.info('Skipped role panel because bot role onboarding is disabled and no bot role controls are configured');
    return;
  }

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
