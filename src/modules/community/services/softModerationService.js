const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const messageActivityRepository = require('../../../db/repositories/messageActivityRepository');
const moderationIncidentRepository = require('../../../db/repositories/moderationIncidentRepository');
const communitySettingsService = require('../../config/services/communitySettingsService');

const LINK_PATTERN = /https?:\/\/\S+/gi;

function linkCount(content) {
  return (String(content || '').match(LINK_PATTERN) || []).length;
}

function mentionCount(message) {
  return (
    message.mentions.users.size +
    message.mentions.roles.size +
    (message.mentions.everyone ? 1 : 0)
  );
}

async function logIncident(client, settings, incident) {
  await moderationIncidentRepository.insertIncident(incident);

  if (!settings.moderation_log_channel_id) return;

  const channel = await client.channels.fetch(settings.moderation_log_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('Soft Moderation Incident')
    .addFields(
      { name: 'User', value: `<@${incident.userId}>`, inline: true },
      { name: 'Channel', value: `<#${incident.channelId}>`, inline: true },
      { name: 'Type', value: incident.incidentType, inline: true },
      { name: 'Action', value: incident.actionTaken, inline: true },
      { name: 'Message ID', value: incident.messageId || 'Unknown', inline: true }
    )
    .setTimestamp();

  if (incident.details?.summary) {
    embed.addFields({
      name: 'Details',
      value: incident.details.summary,
      inline: false
    });
  }

  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
}

async function warnAndDelete(message, settings, incidentType, summary) {
  await message.delete().catch(() => null);
  await message.channel.send({
    content: `${message.author}, slow down a little. ${summary}`,
    allowedMentions: { users: [message.author.id], roles: [], parse: ['users'] }
  }).then(warning => {
    setTimeout(() => {
      warning.delete().catch(() => null);
    }, 10_000);
  }).catch(() => null);

  await logIncident(message.client, settings, {
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channel.id,
    messageId: message.id,
    incidentType,
    actionTaken: 'warn_delete',
    details: { summary }
  });
}

async function processMessage(message) {
  if (!message.guild || message.author.bot || !message.content) {
    return { blocked: false };
  }

  if (message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return { blocked: false };
  }

  const settings = await communitySettingsService.ensureGuildSettings(message.guild.id);
  const messageLinkCount = linkCount(message.content);
  const messageMentionCount = mentionCount(message);

  await messageActivityRepository.recordMessage({
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.author.id,
    messageId: message.id,
    content: message.content,
    mentionCount: messageMentionCount,
    linkCount: messageLinkCount,
    messageLength: message.content.trim().length
  });

  if (!settings.soft_moderation_enabled) {
    return { blocked: false };
  }

  if (message.mentions.everyone || messageMentionCount >= 5) {
    await warnAndDelete(message, settings, 'mention_spam', 'Too many mentions in one message.');
    return { blocked: true };
  }

  if (messageLinkCount >= 3) {
    await warnAndDelete(message, settings, 'link_spam', 'Too many links in one message.');
    return { blocked: true };
  }

  const floodSince = new Date(Date.now() - 10_000);
  const repeatSince = new Date(Date.now() - 10 * 60 * 1000);
  const recentMessages = await messageActivityRepository.listRecentByUser(
    message.guild.id,
    message.author.id,
    floodSince
  );

  if (recentMessages.length >= 6) {
    await warnAndDelete(message, settings, 'message_flood', 'That was a little too fast. Give the chat a moment to breathe.');
    return { blocked: true };
  }

  const duplicateCount = await messageActivityRepository.countDuplicatesSince(
    message.guild.id,
    message.author.id,
    message.content,
    repeatSince
  );

  if (duplicateCount >= 3) {
    await warnAndDelete(message, settings, 'repeat_spam', 'Please do not keep repeating the same message.');
    return { blocked: true };
  }

  return { blocked: false };
}

module.exports = {
  processMessage
};
