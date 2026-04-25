const { EmbedBuilder } = require('discord.js');
const communitySettingsService = require('../../config/services/communitySettingsService');
const videoSubmissionRepository = require('../../../db/repositories/videoSubmissionRepository');
const xpService = require('../../leveling/services/xpService');
const contentTagService = require('../../content/services/contentTagService');
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

async function submitPrepared(interaction, data) {
  const settings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
  if (!settings.video_enabled) {
    throw new Error('Video submissions are currently disabled.');
  }

  if (!settings.video_channel_id) {
    throw new Error('The video channel is not configured yet.');
  }

  const videoUrl = validateYoutubeUrl(data.url);
  if (!videoUrl) {
    throw new Error('Video links must be valid YouTube URLs.');
  }

  const channel = await interaction.client.channels.fetch(settings.video_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error('The configured video channel is missing or not text based.');
  }

  const title = data.title;
  const description = data.description || null;
  const tags = contentTagService.normalizeTags(data.tags || {});

  const submission = await videoSubmissionRepository.createSubmission({
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    title,
    description,
    videoUrl,
    targetChannelId: channel.id,
    sourceInteractionRef: data.sourceInteractionRef || interaction.id
  });

  await videoSubmissionRepository.attachTags(submission.id, tags);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setURL(videoUrl)
    .setDescription(description || 'No description provided.')
    .addFields(
      { name: 'Submitted By', value: `${interaction.user}`, inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true },
      { name: 'Tags', value: contentTagService.tagsToText(tags), inline: false }
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

  const award = await xpService.awardManualXp({
    client: interaction.client,
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    xpDelta: 15,
    sourceType: 'content_submission',
    sourceRef: `video:${submission.id}`,
    metadata: {
      submissionId: submission.id,
      tags,
      title
    }
  }).catch(() => null);

  if (award && award.awarded) {
    await videoSubmissionRepository.updateXpAwarded(submission.id, award.xpDelta).catch(() => null);
  }

  return {
    submission: updated,
    award,
    message
  };
}

async function submit(interaction) {
  return submitPrepared(interaction, {
    title: interaction.options.getString('title', true),
    url: interaction.options.getString('url', true),
    description: interaction.options.getString('description') || null,
    sourceInteractionRef: interaction.id
  });
}

module.exports = {
  submit,
  submitPrepared
};
