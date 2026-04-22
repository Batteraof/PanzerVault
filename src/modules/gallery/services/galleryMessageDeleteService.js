const db = require('../../../db/client');
const gallerySubmissionRepository = require('../../../db/repositories/gallerySubmissionRepository');
const galleryModerationLogRepository = require('../../../db/repositories/galleryModerationLogRepository');
const gallerySettingsService = require('./gallerySettingsService');
const galleryPostService = require('./galleryPostService');
const logger = require('../../../logger');

async function handleDeletedMessage(message) {
  if (!message || !message.guild || !message.id) return;

  const guildId = message.guild.id;
  const submission = await gallerySubmissionRepository.findByMessageId(guildId, message.id);

  if (!submission || submission.status !== 'posted') return;

  const removed = await db.withTransaction(async client => {
    const updated = await gallerySubmissionRepository.markRemoved(
      submission.id,
      null,
      'Gallery message was deleted from Discord.',
      client
    );

    if (!updated) return null;

    await galleryModerationLogRepository.insertLog(
      {
        guildId,
        submissionId: submission.id,
        moderatorId: null,
        action: 'remove',
        reason: 'Gallery message was deleted from Discord.'
      },
      client
    );

    return updated;
  });

  if (!removed) return;

  const settings = await gallerySettingsService.ensureGuildSettings(guildId);

  try {
    await galleryPostService.logGalleryMessageDeleted(message.client, settings, removed);
  } catch (error) {
    logger.warn('Failed to log deleted gallery message', error);
  }
}

module.exports = {
  handleDeletedMessage
};
