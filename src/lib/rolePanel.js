const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const config = require('../config');
const customIds = require('./customIds');
const botSettingsService = require('../modules/config/services/botSettingsService');
const communitySettingsService = require('../modules/config/services/communitySettingsService');
const onboardingRoleService = require('../modules/config/services/onboardingRoleService');
const publicRoleService = require('../modules/config/services/publicRoleService');
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
  const [botSettings, communitySettings, skillRoles, regionRoles, publicRoles] = await Promise.all([
    botSettingsService.ensureGuildSettings(guildId),
    communitySettingsService.ensureGuildSettings(guildId),
    onboardingRoleService.listRolesByGroup(guildId, 'skill'),
    onboardingRoleService.listRolesByGroup(guildId, 'region'),
    publicRoleService.listPublicRoles(guildId)
  ]);

  return {
    botSettings,
    communitySettings,
    skillRoles,
    regionRoles,
    publicRoles
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

  if (data.publicRoles.length > 0) {
    lines.push('', '**Reaction roles:**');
    for (const role of data.publicRoles) {
      if (!role.emoji) continue;
      lines.push(`${role.emoji} - <@&${role.role_id}>`);
    }
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
      message.content.includes('**Role setup:**') ||
      message.content.includes('**Choose your roles:**')
    )
  );
}

async function syncPublicRoleReactions(message, publicRoles) {
  const desired = new Set(
    publicRoles
      .map(role => role.emoji)
      .filter(Boolean)
      .map(publicRoleService.emojiIdentifier)
  );

  for (const reaction of message.reactions.cache.values()) {
    const identifier = reaction.emoji.id || reaction.emoji.name;
    const hasBotReaction = await reaction.users.cache.has(message.client.user.id)
      || await reaction.users.fetch().then(users => users.has(message.client.user.id)).catch(() => false);

    if (hasBotReaction && !desired.has(identifier)) {
      await reaction.users.remove(message.client.user.id).catch(error => {
        logger.warn('Failed to remove stale role panel reaction', error);
      });
    }
  }

  for (const role of publicRoles) {
    if (!role.emoji) continue;
    const identifier = publicRoleService.emojiIdentifier(role.emoji);
    const existingReaction = message.reactions.cache.find(reaction =>
      (reaction.emoji.id || reaction.emoji.name) === identifier
    );

    if (!existingReaction) {
      await message.react(role.emoji).catch(error => {
        logger.warn(`Failed to add role panel reaction ${role.emoji}`, error);
      });
    }
  }
}

async function setupRolePanel(client) {
  const guildId = config.discord.guildId || client.guilds.cache.first()?.id;
  const botSettings = guildId ? await botSettingsService.ensureGuildSettings(guildId) : null;
  const channelId = botSettings?.role_panel_channel_id || config.channels.rolePanel;
  const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
  if (!channel || !channel.isTextBased()) {
    logger.warn('Role panel channel is missing or is not text based', channelId);
    return { ok: false, reason: 'missing_channel', channelId };
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
  const title = data.publicRoles.length > 0 ? 'Choose your roles' : (botOnboardingEnabled ? 'Select your onboarding roles below' : 'Role setup');
  const content = `**${title}:**\n${buildRolePanelContent(data)}`;
  const components = await buildRolePanelComponents(channel.guild.id);

  if (!existing && components.length === 0 && data.publicRoles.length === 0) {
    logger.info('Skipped role panel because bot role onboarding is disabled and no bot role controls are configured');
    return { ok: false, reason: 'no_components', channelId: channel.id };
  }

  if (!existing) {
    const message = await channel.send({ content, components });
    await syncPublicRoleReactions(message, data.publicRoles);
    rolePanelMessageId = message.id;
    logger.info('Created role panel message', message.id);
    return { ok: true, action: 'created', channelId: channel.id, messageId: message.id };
  }

  await existing.edit({ content, components });
  await syncPublicRoleReactions(existing, data.publicRoles);
  rolePanelMessageId = existing.id;
  logger.info('Updated role panel message', existing.id);
  return { ok: true, action: 'updated', channelId: channel.id, messageId: existing.id };
}

module.exports = {
  buildRolePanelComponents,
  buildRolePanelContent,
  buildRolePanelData,
  syncPublicRoleReactions,
  setupRolePanel
};
