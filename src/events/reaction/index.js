const { PermissionsBitField } = require('discord.js');
const config = require('../../config');
const botSettingsService = require('../../modules/config/services/botSettingsService');
const publicRoleService = require('../../modules/config/services/publicRoleService');
const logger = require('../../logger');

function reactionIdentifier(reaction) {
  return reaction.emoji.id || reaction.emoji.name;
}

async function fetchPartial(value) {
  if (value?.partial) {
    return value.fetch();
  }

  return value;
}

async function isRolePanelMessage(message) {
  if (!message.guild || message.author?.id !== message.client.user.id) return false;

  const settings = await botSettingsService.ensureGuildSettings(message.guild.id);
  const channelId = settings.role_panel_channel_id || config.channels.rolePanel;
  if (channelId && message.channel.id !== channelId) return false;

  return String(message.content || '').includes('**Choose your roles:**');
}

async function findPublicRoleForReaction(guildId, reaction) {
  const identifier = reactionIdentifier(reaction);
  const roles = await publicRoleService.listPublicRoles(guildId);
  return roles.find(role =>
    role.emoji &&
    publicRoleService.emojiIdentifier(role.emoji) === identifier
  );
}

async function updateReactionRole(reaction, user, shouldAdd) {
  if (user.bot) return;

  const fullReaction = await fetchPartial(reaction).catch(() => null);
  if (!fullReaction) return;

  const message = await fetchPartial(fullReaction.message).catch(() => null);
  if (!message || !await isRolePanelMessage(message)) return;

  const selected = await findPublicRoleForReaction(message.guild.id, fullReaction);
  if (!selected) return;

  const member = await message.guild.members.fetch(user.id).catch(() => null);
  const role = await message.guild.roles.fetch(selected.role_id).catch(() => null);
  const botMember = message.guild.members.me;

  if (!member || !role || !botMember) return;

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    logger.warn('Cannot manage reaction role because Manage Roles permission is missing');
    return;
  }

  if (botMember.roles.highest.comparePositionTo(role) <= 0) {
    logger.warn(`Cannot manage reaction role ${role.id}; bot role is too low`);
    return;
  }

  if (shouldAdd) {
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role).catch(error => {
        logger.warn(`Failed to add reaction role ${role.id} to ${member.id}`, error);
      });
    }
    return;
  }

  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role).catch(error => {
      logger.warn(`Failed to remove reaction role ${role.id} from ${member.id}`, error);
    });
  }
}

async function handleMessageReactionAdd(reaction, user) {
  return updateReactionRole(reaction, user, true);
}

async function handleMessageReactionRemove(reaction, user) {
  return updateReactionRole(reaction, user, false);
}

module.exports = {
  handleMessageReactionAdd,
  handleMessageReactionRemove
};
