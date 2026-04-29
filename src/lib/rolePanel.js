const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const config = require('../config');
const customIds = require('./customIds');
const { buildTeamRolePicker } = require('./teamRolePicker');
const { buildRoleCategoryPicker } = require('./roleCategoryPicker');
const botSettingsService = require('../modules/config/services/botSettingsService');
const communitySettingsService = require('../modules/config/services/communitySettingsService');
const onboardingRoleService = require('../modules/config/services/onboardingRoleService');
const publicRoleService = require('../modules/config/services/publicRoleService');
const roleCategoryService = require('../modules/config/services/roleCategoryService');
const logger = require('../logger');

let rolePanelMessageId = config.rolePanelMessageId;
let teamPanelMessageId = null;

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
  const [botSettings, communitySettings, categories, skillRoles, regionRoles, publicRoles] = await Promise.all([
    botSettingsService.ensureGuildSettings(guildId),
    communitySettingsService.ensureGuildSettings(guildId),
    roleCategoryService.listCategories(guildId),
    onboardingRoleService.listRolesByGroup(guildId, 'skill'),
    onboardingRoleService.listRolesByGroup(guildId, 'region'),
    publicRoleService.listPublicRoles(guildId)
  ]);

  return {
    botSettings,
    communitySettings,
    categories,
    skillRoles,
    regionRoles,
    publicRoles
  };
}

async function buildRolePanelComponents(guildId) {
  const data = await buildRolePanelData(guildId);
  const components = [];

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
  const lines = [
    '**Role commands**',
    'Use this channel to update bot-managed roles. Role commands are intentionally limited to this channel so changes stay easy to find.',
    '',
    '**Commands**'
  ];

  for (const category of data.categories) {
    lines.push(`- \`/${category.command_name}\` - ${category.description || `Choose ${category.label}.`}`);
  }

  if (data.categories.length === 0) {
    lines.push('- Staff can add role categories from the dashboard.');
  }

  if (data.communitySettings.coach_role_id) {
    lines.push(`- Medium and Expert players can toggle <@&${data.communitySettings.coach_role_id}> to show beginners they can ask you for help.`);
  }

  lines.push('- Pick optional ping/community roles with the reactions below.');

  if (data.publicRoles.length > 0) {
    lines.push('', '**Reaction roles**');
    lines.push('React to add a role. Remove your reaction to remove it.');
    for (const role of data.publicRoles) {
      if (!role.emoji) continue;
      lines.push(`${role.emoji}  <@&${role.role_id}>`);
    }
  } else {
    lines.push('', '**Reaction roles**');
    lines.push('Staff can add optional reaction roles from the dashboard.');
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
      message.content.includes('**Choose your roles:**') ||
      message.content.includes('**Role options:**')
    )
  );
}

async function findExistingTeamPanelMessage(channel, clientUserId) {
  const recentMessages = await channel.messages.fetch({ limit: 25 });
  return recentMessages.find(message =>
    message.author.id === clientUserId &&
    (
      message.content.includes('**Choose your team:**') ||
      message.content.includes('**Team selection:**')
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

async function pinRolePanelMessage(message) {
  if (!message.pinned) {
    await message.pin('Keep role commands at the top of the roles channel.').catch(error => {
      logger.warn('Failed to pin role panel message', error);
    });
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
  const content = buildRolePanelContent(data);
  const components = await buildRolePanelComponents(channel.guild.id);

  if (!existing) {
    const message = await channel.send({ content, components });
    await pinRolePanelMessage(message);
    await syncPublicRoleReactions(message, data.publicRoles);
    rolePanelMessageId = message.id;
    logger.info('Created role panel message', message.id);
    return {
      ok: true,
      action: 'created',
      channelId: channel.id,
      messageId: message.id
    };
  }

  await existing.edit({ content, components });
  await pinRolePanelMessage(existing);
  await syncPublicRoleReactions(existing, data.publicRoles);
  rolePanelMessageId = existing.id;
  logger.info('Updated role panel message', existing.id);
  return {
    ok: true,
    action: 'updated',
    channelId: channel.id,
    messageId: existing.id
  };
}

async function setupTeamPanelInChannel(channel, clientUserId) {
  let existing = null;

  if (teamPanelMessageId) {
    existing = await channel.messages.fetch(teamPanelMessageId).catch(() => null);
  }

  if (!existing) {
    existing = await findExistingTeamPanelMessage(channel, clientUserId);
  }

  const picker = await buildTeamRolePicker(channel.guild.id);
  const content = [
    '**Choose your team**',
    'Pick the group you want shown on your profile. You can change teams any time from this menu.',
    'Use `/team clear` if you want to remove your current team role.',
    '',
    picker.content
  ].join('\n');

  if (!existing) {
    const message = await channel.send({
      content,
      components: picker.components
    });
    teamPanelMessageId = message.id;
    logger.info('Created team panel message', message.id);
    return { ok: true, action: 'created', messageId: message.id };
  }

  await existing.edit({
    content,
    components: picker.components
  });
  teamPanelMessageId = existing.id;
  logger.info('Updated team panel message', existing.id);
  return { ok: true, action: 'updated', messageId: existing.id };
}

module.exports = {
  buildRolePanelComponents,
  buildRolePanelContent,
  buildRolePanelData,
  setupTeamPanelInChannel,
  syncPublicRoleReactions,
  setupRolePanel
};
