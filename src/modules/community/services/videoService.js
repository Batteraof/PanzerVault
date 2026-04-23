const { EmbedBuilder } = require('discord.js');
const communitySettingsService = require('../../config/services/communitySettingsService');
const videoSubmissionRepository = require('../../../db/repositories/videoSubmissionRepository');
const { validateYoutubeUrl, youtubeVideoId } = require('../../gallery/utils/youtubeUtils');

function thumbnailForVideo(url) {
  const videoId = youtubeVideoId(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

async function notifyCommunityChannel(client, settings, submission, message) {
  if (!settings.community_channel_id) return;

  const channel = await client.channels.fetch(settings.community_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  await channel.send({
    content: `New video link from <@${submission.user_id}> is live.\n${message.url}`,
    allowedMentions: { parse: [] }
  }).catch(() => null);
}

async function submit(interaction) {
  const settings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
  if (!settings.video_enabled) {
    throw new Error('Video submissions are currently disabled.');
  }

  if (!settings.video_channel_id) {
    throw new Error('The video channel is not configured yet.');
  }

  const videoUrl = validateYoutubeUrl(interaction.options.getString('url', true));
  if (!videoUrl) {
    throw new Error('Video links must be valid YouTube URLs.');
  }

  const channel = await interaction.client.channels.fetch(settings.video_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error('The configured video channel is missing or not text based.');
  }

  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description') || null;

  const submission = await videoSubmissionRepository.createSubmission({
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    title,
    description,
    videoUrl,
    targetChannelId: channel.id,
    sourceInteractionRef: interaction.id
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setURL(videoUrl)
    .setDescription(description || 'No description provided.')
    .addFields(
      { name: 'Submitted By', value: `${interaction.user}`, inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true }
    )
    .setFooter({ text: `Video #${submission.id}` })
    .setTimestamp();

  const thumbnail = thumbnailForVideo(videoUrl);
  if (thumbnail) {
    embed.setImage(thumbnail);
  }

  const message = await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] }
  });

  const updated = await videoSubmissionRepository.updateMessageId(submission.id, message.id);
  await notifyCommunityChannel(interaction.client, settings, updated, message);

  return {
    submission: updated,
    message
  };
}

module.exports = {
  submit
};
