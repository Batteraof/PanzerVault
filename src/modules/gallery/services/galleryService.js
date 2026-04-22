const db = require('../../../db/client');
const gallerySubmissionRepository = require('../../../db/repositories/gallerySubmissionRepository');
const galleryModerationLogRepository = require('../../../db/repositories/galleryModerationLogRepository');
const gallerySettingsService = require('./gallerySettingsService');
const galleryValidationService = require('./galleryValidationService');
const galleryTagService = require('./galleryTagService');
const galleryRateLimitService = require('./galleryRateLimitService');
const galleryPostService = require('./galleryPostService');
const galleryBlacklistRepository = require('../../../db/repositories/galleryBlacklistRepository');
const { GalleryUserError } = require('../utils/galleryErrors');
const logger = require('../../../logger');

async function ensureGuildGallerySetup(guildId, client) {
  const settings = await gallerySettingsService.ensureGuildSettings(guildId, client);
  await galleryTagService.ensureDefaultTags(guildId, client);
  return settings;
}

async function createSubmissionRecord(interaction, input, settings) {
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
        sourceRef: interaction.id
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
  const settings = await ensureGuildGallerySetup(interaction.guild.id);

  if (!settings.gallery_enabled) {
    throw new GalleryUserError('The gallery is currently disabled.');
  }

  const created = await createSubmissionRecord(interaction, input, settings);

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
  listTags,
  ensureGuildGallerySetup
};
