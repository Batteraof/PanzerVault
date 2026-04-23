const { EmbedBuilder } = require('discord.js');
const videoSubmissionRepository = require('../../../db/repositories/videoSubmissionRepository');
const communitySettingsService = require('../../config/services/communitySettingsService');
const logger = require('../../../logger');

async function logDeletedVideoMessage(client, settings, submission) {
  if (!settings.moderation_log_channel_id) return;

  const channel = await client.channels.fetch(settings.moderation_log_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('Video Post Deleted')
    .addFields(
      { name: 'Video', value: `#${submission.id}`, inline: true },
      { name: 'Submitter', value: `<@${submission.user_id}>`, inline: true },
      { name: 'Message ID', value: submission.message_id || 'Unknown', inline: true },
      { name: 'Title', value: submission.title, inline: false }
    )
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] }
  }).catch(() => null);
}

async function handleDeletedMessage(message) {
  if (!message || !message.guild || !message.id) return;

  const submission = await videoSubmissionRepository.findByMessageId(message.guild.id, message.id);
  if (!submission || submission.status !== 'posted') return;

  const removed = await videoSubmissionRepository.markRemoved(
    submission.id,
    null,
    'Video message was deleted from Discord.'
  );

  if (!removed) return;

  try {
    const settings = await communitySettingsService.ensureGuildSettings(message.guild.id);
    await logDeletedVideoMessage(message.client, settings, removed);
  } catch (error) {
    logger.warn('Failed to log deleted video message', error);
  }
}

module.exports = {
  handleDeletedMessage
};
