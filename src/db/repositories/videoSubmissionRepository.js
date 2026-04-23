const db = require('../client');

function executor(client) {
  return client || db;
}

async function createSubmission(data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO video_submissions (
      guild_id,
      user_id,
      title,
      description,
      video_url,
      target_channel_id,
      source_interaction_ref,
      message_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      data.guildId,
      data.userId,
      data.title,
      data.description || null,
      data.videoUrl,
      data.targetChannelId,
      data.sourceInteractionRef || null,
      data.messageId || null
    ]
  );

  return result.rows[0] || null;
}

async function updateMessageId(submissionId, messageId, client) {
  const result = await executor(client).query(
    `
    UPDATE video_submissions
    SET message_id = $2, updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [submissionId, messageId]
  );

  return result.rows[0] || null;
}

async function findByMessageId(guildId, messageId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM video_submissions
    WHERE guild_id = $1 AND message_id = $2
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [guildId, messageId]
  );

  return result.rows[0] || null;
}

async function markRemoved(submissionId, removedBy, reason, client) {
  const result = await executor(client).query(
    `
    UPDATE video_submissions
    SET
      status = 'removed',
      removed_at = now(),
      removed_by = $2,
      removal_reason = $3,
      updated_at = now()
    WHERE id = $1
      AND status = 'posted'
    RETURNING *
    `,
    [submissionId, removedBy || null, reason || null]
  );

  return result.rows[0] || null;
}

async function countPostedBetween(guildId, start, end, client) {
  const result = await executor(client).query(
    `
    SELECT COUNT(*)::integer AS count
    FROM video_submissions
    WHERE guild_id = $1
      AND status = 'posted'
      AND created_at >= $2
      AND created_at < $3
    `,
    [guildId, start, end]
  );

  return result.rows[0] ? result.rows[0].count : 0;
}

module.exports = {
  createSubmission,
  updateMessageId,
  findByMessageId,
  markRemoved,
  countPostedBetween
};
