const galleryRateLimitRepository = require('../../../db/repositories/galleryRateLimitRepository');
const gallerySubmissionRepository = require('../../../db/repositories/gallerySubmissionRepository');
const {
  COOLDOWN_MS,
  MAX_SUBMISSIONS_PER_24H
} = require('../constants/galleryConfig');
const { GalleryUserError } = require('../utils/galleryErrors');

function formatWait(ms) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function cooldownLabel() {
  return formatWait(COOLDOWN_MS);
}

async function assertCanSubmit(guildId, userId, now, client) {
  const limit = await galleryRateLimitRepository.lockUserLimit(guildId, userId, client);

  if (limit.last_submission_at) {
    const lastSubmissionAt = new Date(limit.last_submission_at);
    const elapsed = now.getTime() - lastSubmissionAt.getTime();

    if (elapsed < COOLDOWN_MS) {
      throw new GalleryUserError(
        `Gallery submissions are limited to one every ${cooldownLabel()}. Try again in ${formatWait(COOLDOWN_MS - elapsed)}.`
      );
    }
  }

  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const submissionsLast24h = await gallerySubmissionRepository.countUserSubmissionsSince(
    guildId,
    userId,
    oneDayAgo,
    client
  );

  if (submissionsLast24h >= MAX_SUBMISSIONS_PER_24H) {
    throw new GalleryUserError(
      `Gallery submissions are limited to ${MAX_SUBMISSIONS_PER_24H} per rolling 24 hours.`
    );
  }
}

async function recordSubmission(guildId, userId, submittedAt, client) {
  return galleryRateLimitRepository.updateLastSubmissionAt(guildId, userId, submittedAt, client);
}

module.exports = {
  assertCanSubmit,
  recordSubmission
};
