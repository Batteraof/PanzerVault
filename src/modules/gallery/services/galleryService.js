const db = require('../../../db/client');
const gallerySubmissionRepository = require('../../../db/repositories/gallerySubmissionRepository');
const galleryModerationLogRepository = require('../../../db/repositories/galleryModerationLogRepository');
const gallerySettingsService = require('./gallerySettingsService');
const galleryValidationService = require('./galleryValidationService');
const galleryTagService = require('./galleryTagService');
const galleryRateLimitService = require('./galleryRateLimitService');
const galleryPostService = require('./galleryPostService');
const galleryBlacklistRepository = require('../../../db/repositories/galleryBlacklistRepository');
const communitySettingsService = require('../../config/services/communitySettingsService');
const { CATEGORIES } = require('../constants/galleryConfig');
const { GalleryUserError } = require('../utils/galleryErrors');
const logger = require('../../../logger');

async function notifyShowcasePosted(client, guildId, submission, message) {
  if (submission.category !== CATEGORIES.SHOWCASE) return;

  const communitySettings = await communitySettingsService.ensureGuildSettings(guildId);
  if (!communitySettings.community_channel_id) return;

  const channel = await client.channels.fetch(communitySettings.community_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  await channel.send({
    content: `New showcase post from <@${submission.user_id}> is live.\n${message.url}`,
    allowedMentions: { parse: [] }
  }).catch(() => null);
}

async function ensureGuildGallerySetup(guildId, client) {
  const settings = await gallerySettingsService.ensureGuildSettings(guildId, client);
  await galleryTagService.ensureDefaultTags(guildId, client);
  return settings;
}

async function createSubmissionRecord(interaction, input, settings, options = {}) {
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const now = new Date();
  const targetChannelId = gallerySettingsService.getTargetChannelId(settings, input.category);

  if (!targetChannelId) {
    throw new GalleryUserError('Gallery channels are not configured yet. Ask staff to set the gallery channel IDs.');
  }

  return db.withTransaction(async client => {
    const txSettings = await ensureGuildGallerySetup(guildId, client);

    if (!txSettings.gallery_enabled) {
      throw new GalleryUserError('The gallery is currently disabled.');
    }

    const txTargetChannelId = gallerySettingsService.getTargetChannelId(txSettings, input.category);
    if (!txTargetChannelId) {
      throw new GalleryUserError('Gallery channels are not configured yet. Ask staff to set the gallery channel IDs.');
    }

    const tags = await galleryTagService.validateTags(guildId, input.category, input.tagsInput, client);

    const blacklist = await galleryBlacklistRepository.getActive(guildId, userId, client);
    if (blacklist) {
      throw new GalleryUserError('You are currently blocked from submitting to the gallery.');
    }

    await galleryRateLimitService.assertCanSubmit(guildId, userId, now, client);

    const submission = await gallerySubmissionRepository.createSubmission(
      {
        guildId,
        userId,
        category: input.category,
        caption: input.caption,
        videoLink: input.videoLink,
        targetChannelId: txTargetChannelId,
        sourceRef: options.sourceRef || interaction.id
      },
      client
    );

    const assets = await gallerySubmissionRepository.insertAssets(submission.id, input.assets, client);
    await gallerySubmissionRepository.attachTags(submission.id, tags.map(tag => tag.id), client);
    await galleryRateLimitService.recordSubmission(guildId, userId, now, client);

    return {
      settings: txSettings,
      submission,
      assets,
      tags
    };
  });
}

async function submit(interaction) {
  if (!interaction.guild) {
    throw new GalleryUserError('Gallery submissions can only be used in a server.');
  }

  const input = galleryValidationService.getSubmitInput(interaction);
  return submitPrepared(interaction, input);
}

async function submitPrepared(interaction, rawInput, options = {}) {
  if (!interaction.guild) {
    throw new GalleryUserError('Gallery submissions can only be used in a server.');
  }

  const input = galleryValidationService.buildSubmitInput(rawInput);
  const settings = await ensureGuildGallerySetup(interaction.guild.id);

  if (!settings.gallery_enabled) {
    throw new GalleryUserError('The gallery is currently disabled.');
  }

  const created = await createSubmissionRecord(interaction, input, settings, options);

  try {
    const message = await galleryPostService.postSubmission(
      interaction.client,
      created.submission,
      created.assets,
      created.tags,
      interaction.user
    );

    const updatedSubmission = await gallerySubmissionRepository.updateGalleryMessageId(
      created.submission.id,
      message.id
    );

    await galleryModerationLogRepository.insertLog({
      guildId: interaction.guild.id,
      submissionId: updatedSubmission.id,
      moderatorId: interaction.user.id,
      action: 'submit',
      reason: null
    });

    await galleryPostService.logSubmissionPosted(
      interaction.client,
      created.settings,
      updatedSubmission,
      interaction.user
    );
    await notifyShowcasePosted(interaction.client, interaction.guild.id, updatedSubmission, message);

    return {
      submission: updatedSubmission,
      message
    };
  } catch (error) {
    logger.error('Gallery submission was saved but could not be posted', error);

    await gallerySubmissionRepository.markRemoved(
      created.submission.id,
      interaction.client.user ? interaction.client.user.id : null,
      `Post failed: ${error.message}`
    );

    throw new GalleryUserError('Your submission was valid, but I could not post it to the gallery channel.');
  }
}

async function listTags(guildId, category = null) {
  return galleryTagService.listTags(guildId, category);
}

module.exports = {
  submit,
  submitPrepared,
  listTags,
  ensureGuildGallerySetup
};
