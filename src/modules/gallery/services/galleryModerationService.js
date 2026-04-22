const { PermissionFlagsBits } = require('discord.js');
const db = require('../../../db/client');
const gallerySubmissionRepository = require('../../../db/repositories/gallerySubmissionRepository');
const galleryModerationLogRepository = require('../../../db/repositories/galleryModerationLogRepository');
const galleryBlacklistRepository = require('../../../db/repositories/galleryBlacklistRepository');
const gallerySettingsService = require('./gallerySettingsService');
const galleryPostService = require('./galleryPostService');
const { GalleryUserError } = require('../utils/galleryErrors');

function hasModeratorPermission(member) {
  if (!member || !member.permissions) return false;
  return (
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

async function resolveSubmission(guildId, options, client) {
  if (options.submissionId) {
    return gallerySubmissionRepository.findById(guildId, options.submissionId, client);
  }

  if (options.messageId) {
    return gallerySubmissionRepository.findByMessageId(guildId, options.messageId, client);
  }

  throw new GalleryUserError('Provide either a submission ID or gallery message ID.');
}

async function removeSubmission(interaction, options) {
  if (!hasModeratorPermission(interaction.member)) {
    throw new GalleryUserError('You need Manage Messages or Manage Server permission to remove gallery posts.');
  }

  const guildId = interaction.guild.id;
  const reason = options.reason || null;
  const settings = await gallerySettingsService.ensureGuildSettings(guildId);
  const submission = await resolveSubmission(guildId, options);

  if (!submission) {
    throw new GalleryUserError('I could not find that gallery submission.');
  }

  if (submission.status === 'removed') {
    throw new GalleryUserError(`Gallery submission #${submission.id} is already removed.`);
  }

  const removed = await db.withTransaction(async client => {
    const updated = await gallerySubmissionRepository.markRemoved(
      submission.id,
      interaction.user.id,
      reason,
      client
    );

    if (!updated) return null;

    await galleryModerationLogRepository.insertLog(
      {
        guildId,
        submissionId: submission.id,
        moderatorId: interaction.user.id,
        action: 'remove',
        reason
      },
      client
    );

    return updated;
  });

  if (!removed) {
    throw new GalleryUserError(`Gallery submission #${submission.id} is already removed.`);
  }

  const deletionResult = await galleryPostService.deleteGalleryMessage(interaction.client, removed);
  await galleryPostService.logSubmissionRemoved(
    interaction.client,
    settings,
    removed,
    interaction.user,
    reason,
    deletionResult
  );

  return {
    submission: removed,
    deletionResult
  };
}

async function blacklistUser(interaction, targetUser, reason = null) {
  if (!hasModeratorPermission(interaction.member)) {
    throw new GalleryUserError('You need Manage Messages or Manage Server permission to blacklist gallery users.');
  }

  if (targetUser.bot) {
    throw new GalleryUserError('Bot users do not need gallery blacklist entries.');
  }

  const guildId = interaction.guild.id;
  const settings = await gallerySettingsService.ensureGuildSettings(guildId);

  const entry = await db.withTransaction(async client => {
    const row = await galleryBlacklistRepository.blacklistUser(
      guildId,
      targetUser.id,
      interaction.user.id,
      reason,
      client
    );

    await galleryModerationLogRepository.insertLog(
      {
        guildId,
        submissionId: null,
        moderatorId: interaction.user.id,
        action: 'blacklist',
        reason: reason || `Blacklisted user ${targetUser.id}`
      },
      client
    );

    return row;
  });

  await galleryPostService.logGalleryBlacklist(
    interaction.client,
    settings,
    targetUser,
    interaction.user,
    reason,
    true
  );

  return entry;
}

async function unblacklistUser(interaction, targetUser, reason = null) {
  if (!hasModeratorPermission(interaction.member)) {
    throw new GalleryUserError('You need Manage Messages or Manage Server permission to unblacklist gallery users.');
  }

  const guildId = interaction.guild.id;
  const settings = await gallerySettingsService.ensureGuildSettings(guildId);

  const entry = await db.withTransaction(async client => {
    const row = await galleryBlacklistRepository.unblacklistUser(
      guildId,
      targetUser.id,
      interaction.user.id,
      reason,
      client
    );

    if (!row) return null;

    await galleryModerationLogRepository.insertLog(
      {
        guildId,
        submissionId: null,
        moderatorId: interaction.user.id,
        action: 'unblacklist',
        reason: reason || `Unblacklisted user ${targetUser.id}`
      },
      client
    );

    return row;
  });

  if (!entry) {
    throw new GalleryUserError('That user is not currently gallery-blacklisted.');
  }

  await galleryPostService.logGalleryBlacklist(
    interaction.client,
    settings,
    targetUser,
    interaction.user,
    reason,
    false
  );

  return entry;
}

module.exports = {
  removeSubmission,
  blacklistUser,
  unblacklistUser,
  hasModeratorPermission
};
