const { extname } = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const db = require('../../../db/client');
const mediaSubmissionRepository = require('../../../db/repositories/mediaSubmissionRepository');
const mediaTagRepository = require('../../../db/repositories/mediaTagRepository');
const communitySettingsService = require('../../config/services/communitySettingsService');
const mediaTagService = require('./mediaTagService');
const { validateYoutubeUrl } = require('../../gallery/utils/youtubeUtils');
const customIds = require('../../../lib/customIds');
const logger = require('../../../logger');

const MEDIA_KIND_LABELS = {
  image: 'Screenshots / Art',
  video_attachment: 'Uploaded Video',
  video_link: 'YouTube Link',
  mixed: 'Mixed Media'
};

function buildCustomId(action, submissionId) {
  return `${customIds.MEDIA_INTAKE_PREFIX}:${action}:${submissionId}`;
}

function findYoutubeLinks(content) {
  const matches = String(content || '').match(/https?:\/\/\S+/gi) || [];
  const links = [];

  for (const match of matches) {
    const valid = validateYoutubeUrl(match);
    if (!valid || links.includes(valid)) continue;
    links.push(valid);
  }

  return links;
}

function summarizeDetectedMedia(media) {
  const parts = [];

  if (media.imageAttachments.length) {
    parts.push(`${media.imageAttachments.length} image${media.imageAttachments.length === 1 ? '' : 's'}`);
  }

  if (media.videoAttachments.length) {
    parts.push(`${media.videoAttachments.length} uploaded video${media.videoAttachments.length === 1 ? '' : 's'}`);
  }

  if (media.youtubeLinks.length) {
    parts.push(`${media.youtubeLinks.length} YouTube link${media.youtubeLinks.length === 1 ? '' : 's'}`);
  }

  return parts.join(', ') || 'Unsupported post';
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v']);

function attachmentExtension(attachment) {
  const rawName = attachment?.name || attachment?.filename || attachment?.url || '';
  return extname(String(rawName)).toLowerCase();
}

function isImageAttachment(attachment) {
  const contentType = String(attachment?.contentType || '');
  if (contentType.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(attachmentExtension(attachment));
}

function isVideoAttachment(attachment) {
  const contentType = String(attachment?.contentType || '');
  if (contentType.startsWith('video/')) return true;
  return VIDEO_EXTENSIONS.has(attachmentExtension(attachment));
}

function detectMedia(message) {
  const attachments = [...message.attachments.values()];
  const imageAttachments = attachments.filter(isImageAttachment);
  const videoAttachments = attachments.filter(isVideoAttachment);
  const youtubeLinks = findYoutubeLinks(message.content);

  if (!imageAttachments.length && !videoAttachments.length && !youtubeLinks.length) {
    return null;
  }

  let mediaKind = 'mixed';
  if (imageAttachments.length && !videoAttachments.length && !youtubeLinks.length) mediaKind = 'image';
  else if (!imageAttachments.length && videoAttachments.length && !youtubeLinks.length) mediaKind = 'video_attachment';
  else if (!imageAttachments.length && !videoAttachments.length && youtubeLinks.length) mediaKind = 'video_link';

  return {
    mediaKind,
    imageAttachments,
    videoAttachments,
    youtubeLinks,
    attachmentPayload: attachments.map((attachment, index) => ({
      id: attachment.id,
      url: attachment.url,
      filename: attachment.name,
      contentType: attachment.contentType || null,
      size: attachment.size || null,
      displayOrder: index
    }))
  };
}

function buildPromptPayload(submission) {
  const sourcePayload = submission.source_payload || {};
  const details = sourcePayload.summary || MEDIA_KIND_LABELS[submission.media_kind] || 'Media';

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Add Media Details')
    .setDescription('This post is already live. Click **Add details** to attach a title, tags, and an optional description in a cleaner popup flow.')
    .addFields(
      {
        name: 'Detected',
        value: details,
        inline: false
      },
      {
        name: 'Why this helps',
        value: 'Saved tags become reusable for the next person, and close matches can be suggested before new tags are created.',
        inline: false
      }
    )
    .setFooter({ text: 'General Bot Media Prompt' })
    .setTimestamp(new Date(submission.created_at));

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('details', submission.id))
        .setLabel('Add details')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(buildCustomId('dismiss', submission.id))
        .setLabel('Dismiss')
        .setStyle(ButtonStyle.Secondary)
    )
  ];

  return {
    content: 'Media detected. Add the details when you are ready.',
    embeds: [embed],
    components
  };
}

function collectPublishedLinks(sourcePayload = {}) {
  const attachments = Array.isArray(sourcePayload.attachments) ? sourcePayload.attachments : [];
  const youtubeLinks = Array.isArray(sourcePayload.youtubeLinks) ? sourcePayload.youtubeLinks : [];
  const imageAttachments = attachments.filter(isImageAttachment);
  const videoAttachments = attachments.filter(isVideoAttachment);
  const primaryImage = imageAttachments[0] || null;
  const extraImageLinks = imageAttachments
    .slice(primaryImage ? 1 : 0)
    .map(attachment => attachment.url)
    .filter(Boolean);
  const videoLinks = videoAttachments
    .map(attachment => attachment.url)
    .filter(Boolean);

  return {
    primaryImage,
    extraImageLinks,
    videoLinks,
    youtubeLinks: youtubeLinks.filter(Boolean)
  };
}

function buildCompletedPayload(submission, tags) {
  const sourcePayload = submission.source_payload || {};
  const links = collectPublishedLinks(sourcePayload);
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(submission.title || 'Untitled media post')
    .setDescription(submission.description || 'No description provided.')
    .addFields(
      {
        name: 'Type',
        value: MEDIA_KIND_LABELS[submission.media_kind] || 'Media',
        inline: true
      },
      {
        name: 'Submitted by',
        value: `<@${submission.user_id}>`,
        inline: true
      },
      {
        name: 'Tags',
        value: mediaTagService.formatTagList(tags),
        inline: false
      }
    )
    .setFooter({ text: `Media post #${submission.id}` })
    .setTimestamp(new Date(submission.updated_at || submission.created_at));

  if (links.primaryImage?.url) {
    embed.setImage(links.primaryImage.url);
  }

  if (links.youtubeLinks[0]) {
    embed.setURL(links.youtubeLinks[0]);
  }

  const supportingLinks = [
    ...links.videoLinks,
    ...links.youtubeLinks,
    ...links.extraImageLinks
  ];

  if (supportingLinks.length) {
    embed.addFields({
      name: 'Media links',
      value: supportingLinks
        .map((url, index) => `[Open media ${index + 1}](${url})`)
        .join(`\n`)
        .slice(0, 1024),
      inline: false
    });
  }

  return {
    content: supportingLinks.join(`\n`) || null,
    embeds: [embed],
    components: [],
    allowedMentions: { parse: [] }
  };
}
function buildDismissedPayload() {
  return {
    content: 'Media details skipped for this post.',
    embeds: [],
    components: [],
    allowedMentions: { parse: [] }
  };
}

async function updateBotMessage(client, submission, payload) {
  if (!submission.bot_message_id) return;

  const channel = await client.channels.fetch(submission.channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const message = await channel.messages.fetch(submission.bot_message_id).catch(() => null);
  if (!message) return;

  await message.edit(payload).catch(error => {
    logger.warn('Failed to update media intake bot message', error);
  });
}

async function deleteMessageById(client, channelId, messageId) {
  if (!messageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  await message.delete().catch(() => null);
}

async function deleteBotMessage(client, submission) {
  if (!submission.bot_message_id) return;
  await deleteMessageById(client, submission.channel_id, submission.bot_message_id);
}
async function processMessage(message) {
  if (!message.guild || !message.channel || message.author?.bot) return false;

  const detected = detectMedia(message);
  if (!detected) return false;

  const settings = await communitySettingsService.ensureGuildSettings(message.guild.id);
  if (!settings.media_channel_id || settings.media_channel_id !== message.channel.id) {
    return false;
  }

  const existing = await mediaSubmissionRepository.findBySourceMessageId(message.guild.id, message.id);
  if (existing) return true;

  const submission = await mediaSubmissionRepository.createSubmission({
    guildId: message.guild.id,
    channelId: message.channel.id,
    sourceMessageId: message.id,
    userId: message.author.id,
    mediaKind: detected.mediaKind,
    sourcePayload: {
      summary: summarizeDetectedMedia(detected),
      attachments: detected.attachmentPayload,
      youtubeLinks: detected.youtubeLinks
    }
  });

  const reply = await message.reply({
    ...buildPromptPayload(submission),
    allowedMentions: { parse: [] }
  });

  await mediaSubmissionRepository.updateBotMessageId(submission.id, reply.id);
  return true;
}

async function completeSubmission(client, submissionId, userId, data) {
  const result = await db.withTransaction(async transactionClient => {
    const submission = await mediaSubmissionRepository.findById(submissionId, transactionClient);
    if (!submission) {
      throw new Error('That media post no longer exists.');
    }

    const persistedTags = await mediaTagService.persistResolvedTags(
      submission.guild_id,
      userId,
      data.tags,
      transactionClient
    );

    await mediaSubmissionRepository.replaceTags(
      submission.id,
      persistedTags.map(tag => tag.id),
      transactionClient
    );
    await mediaTagRepository.incrementUsage(
      persistedTags.map(tag => tag.id),
      transactionClient
    );

    const updatedSubmission = await mediaSubmissionRepository.saveMetadata(
      submission.id,
      {
        title: data.title,
        description: data.description || null,
        status: 'completed'
      },
      transactionClient
    );

    return {
      submission: updatedSubmission,
      tags: persistedTags
    };
  });

  const promptMessageId = result.submission.bot_message_id;
  const channel = await client.channels.fetch(result.submission.channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error('I could not publish the finished media post because the media channel is unavailable.');
  }

  const publishedMessage = await channel.send(buildCompletedPayload(result.submission, result.tags));
  await mediaSubmissionRepository.updateBotMessageId(result.submission.id, publishedMessage.id).catch(error => {
    logger.warn('Failed to store final media message id', error);
  });

  const sourceMessage = await channel.messages.fetch(result.submission.source_message_id).catch(() => null);
  if (sourceMessage) {
    await sourceMessage.delete().catch(error => {
      logger.warn('Failed to delete original media post after publishing final version', error);
    });
  }

  if (promptMessageId) {
    await deleteMessageById(client, result.submission.channel_id, promptMessageId);
  }

  return {
    ...result,
    publishedMessageId: publishedMessage.id
  };
}
async function dismissSubmission(client, submissionId) {
  const submission = await mediaSubmissionRepository.markDismissed(submissionId);
  if (!submission) return null;

  await updateBotMessage(client, submission, buildDismissedPayload());
  return submission;
}

async function removeForDeletedSourceMessage(message) {
  if (!message || !message.guild || !message.id) return null;

  const removed = await mediaSubmissionRepository.markRemovedBySourceMessage(
    message.guild.id,
    message.id
  );

  if (!removed) return null;

  await deleteBotMessage(message.client, removed);
  return removed;
}

module.exports = {
  MEDIA_KIND_LABELS,
  buildPromptPayload,
  buildCompletedPayload,
  buildDismissedPayload,
  processMessage,
  completeSubmission,
  dismissSubmission,
  removeForDeletedSourceMessage
};