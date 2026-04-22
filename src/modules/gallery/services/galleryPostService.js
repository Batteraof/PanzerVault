const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const {
  CATEGORY_LABELS,
  CATEGORIES
} = require('../constants/galleryConfig');
const { publicGalleryFilename } = require('../utils/fileUtils');
const logger = require('../../../logger');

function categoryColor(category) {
  if (category === CATEGORIES.MEME) return 0xFEE75C;
  return 0x5865F2;
}

function formatTags(tags) {
  if (!tags || tags.length === 0) return null;
  return tags.map(tag => tag.tag_name).join(', ');
}

function buildGalleryEmbeds(submission, assets, tags, submitter) {
  const tagText = formatTags(tags);
  const categoryLabel = CATEGORY_LABELS[submission.category] || submission.category;
  const embeds = [];

  for (const asset of assets) {
    const fileName = publicGalleryFilename(submission.id, asset);
    const embed = new EmbedBuilder()
      .setColor(categoryColor(submission.category))
      .setImage(`attachment://${fileName}`)
      .setTimestamp(new Date(submission.created_at || Date.now()))
      .setFooter({ text: `Gallery submission #${submission.id}` });

    if (embeds.length === 0) {
      embed
        .setTitle(`${categoryLabel} Gallery`)
        .setAuthor({
          name: submitter ? submitter.username : `User ${submission.user_id}`,
          iconURL: submitter ? submitter.displayAvatarURL({ size: 128 }) : undefined
        })
        .addFields({ name: 'Category', value: categoryLabel, inline: true });

      if (submission.caption) {
        embed.setDescription(submission.caption);
      }

      if (tagText) {
        embed.addFields({ name: 'Tags', value: tagText, inline: true });
      }

      if (submission.video_link) {
        embed.addFields({
          name: 'YouTube',
          value: `[Watch video](${submission.video_link})`,
          inline: false
        });
      }
    }

    embeds.push(embed);
  }

  return embeds;
}

function buildGalleryFiles(submission, assets) {
  return assets.map(asset =>
    new AttachmentBuilder(asset.attachment_url, {
      name: publicGalleryFilename(submission.id, asset),
      description: `Gallery submission ${submission.id} image ${asset.display_order}`
    })
  );
}

async function fetchTextChannel(client, channelId) {
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return null;
  return channel;
}

async function postSubmission(client, submission, assets, tags, submitter) {
  const channel = await fetchTextChannel(client, submission.target_channel_id);
  if (!channel) {
    throw new Error(`Gallery target channel is missing or not text based: ${submission.target_channel_id}`);
  }

  const files = buildGalleryFiles(submission, assets);
  const embeds = buildGalleryEmbeds(submission, assets, tags, submitter);

  return channel.send({
    embeds,
    files,
    allowedMentions: { parse: [] }
  });
}

async function deleteGalleryMessage(client, submission) {
  if (!submission.gallery_message_id) return { deleted: false, reason: 'missing_message_id' };

  const channel = await fetchTextChannel(client, submission.target_channel_id);
  if (!channel) return { deleted: false, reason: 'missing_channel' };

  const message = await channel.messages.fetch(submission.gallery_message_id).catch(() => null);
  if (!message) return { deleted: false, reason: 'missing_message' };

  await message.delete();
  return { deleted: true };
}

async function sendLog(client, settings, embed) {
  if (!settings || !settings.log_channel_id) return;

  const channel = await fetchTextChannel(client, settings.log_channel_id);
  if (!channel) {
    logger.warn('Gallery log channel is missing or not text based', settings.log_channel_id);
    return;
  }

  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] }
  });
}

async function logSubmissionPosted(client, settings, submission, submitter) {
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('Gallery Submission Posted')
    .addFields(
      { name: 'Submission', value: `#${submission.id}`, inline: true },
      { name: 'Category', value: CATEGORY_LABELS[submission.category] || submission.category, inline: true },
      { name: 'Submitter', value: `<@${submission.user_id}>`, inline: true },
      { name: 'Channel', value: `<#${submission.target_channel_id}>`, inline: true }
    )
    .setTimestamp();

  if (submission.gallery_message_id) {
    embed.addFields({ name: 'Message ID', value: submission.gallery_message_id, inline: true });
  }

  if (submitter) {
    embed.setAuthor({ name: submitter.username, iconURL: submitter.displayAvatarURL({ size: 128 }) });
  }

  await sendLog(client, settings, embed);
}

async function logSubmissionRemoved(client, settings, submission, moderator, reason, deletionResult) {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('Gallery Submission Removed')
    .addFields(
      { name: 'Submission', value: `#${submission.id}`, inline: true },
      { name: 'Category', value: CATEGORY_LABELS[submission.category] || submission.category, inline: true },
      { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided.', inline: false },
      {
        name: 'Public Message',
        value: deletionResult.deleted ? 'Deleted' : `Not deleted (${deletionResult.reason})`,
        inline: true
      }
    )
    .setTimestamp();

  await sendLog(client, settings, embed);
}

async function logGalleryBlacklist(client, settings, targetUser, moderator, reason, isBlacklisted) {
  const embed = new EmbedBuilder()
    .setColor(isBlacklisted ? 0xED4245 : 0x57F287)
    .setTitle(isBlacklisted ? 'Gallery User Blacklisted' : 'Gallery User Unblacklisted')
    .addFields(
      { name: 'User', value: `<@${targetUser.id}>`, inline: true },
      { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided.', inline: false }
    )
    .setTimestamp();

  await sendLog(client, settings, embed);
}

async function logGalleryMessageDeleted(client, settings, submission) {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('Gallery Message Deleted')
    .addFields(
      { name: 'Submission', value: `#${submission.id}`, inline: true },
      { name: 'Category', value: CATEGORY_LABELS[submission.category] || submission.category, inline: true },
      { name: 'Submitter', value: `<@${submission.user_id}>`, inline: true },
      { name: 'Message ID', value: submission.gallery_message_id || 'Unknown', inline: true }
    )
    .setTimestamp();

  await sendLog(client, settings, embed);
}

module.exports = {
  postSubmission,
  deleteGalleryMessage,
  logSubmissionPosted,
  logSubmissionRemoved,
  logGalleryBlacklist,
  logGalleryMessageDeleted,
  buildGalleryEmbeds,
  buildGalleryFiles
};
