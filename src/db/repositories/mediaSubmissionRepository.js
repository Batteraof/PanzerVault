const db = require('../client');

function executor(client) {
  return client || db;
}

async function createSubmission(data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO media_submissions (
      guild_id,
      channel_id,
      source_message_id,
      bot_message_id,
      user_id,
      media_kind,
      source_payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING *
    `,
    [
      data.guildId,
      data.channelId,
      data.sourceMessageId,
      data.botMessageId || null,
      data.userId,
      data.mediaKind,
      JSON.stringify(data.sourcePayload || {})
    ]
  );

  return result.rows[0] || null;
}

async function findById(submissionId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM media_submissions
    WHERE id = $1
    `,
    [submissionId]
  );

  return result.rows[0] || null;
}

async function findBySourceMessageId(guildId, sourceMessageId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM media_submissions
    WHERE guild_id = $1 AND source_message_id = $2
    LIMIT 1
    `,
    [guildId, sourceMessageId]
  );

  return result.rows[0] || null;
}

async function findByBotMessageId(guildId, botMessageId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM media_submissions
    WHERE guild_id = $1 AND bot_message_id = $2
    LIMIT 1
    `,
    [guildId, botMessageId]
  );

  return result.rows[0] || null;
}

async function updateBotMessageId(submissionId, botMessageId, client) {
  const result = await executor(client).query(
    `
    UPDATE media_submissions
    SET bot_message_id = $2, updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [submissionId, botMessageId || null]
  );

  return result.rows[0] || null;
}

async function clearBotMessageId(submissionId, client) {
  return updateBotMessageId(submissionId, null, client);
}

async function saveMetadata(submissionId, data, client) {
  const result = await executor(client).query(
    `
    UPDATE media_submissions
    SET
      title = $2,
      description = $3,
      status = $4,
      updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [
      submissionId,
      data.title,
      data.description || null,
      data.status || 'completed'
    ]
  );

  return result.rows[0] || null;
}

async function markDismissed(submissionId, client) {
  const result = await executor(client).query(
    `
    UPDATE media_submissions
    SET status = 'dismissed', updated_at = now()
    WHERE id = $1
      AND status = 'pending'
    RETURNING *
    `,
    [submissionId]
  );

  return result.rows[0] || null;
}

async function markRemovedBySourceMessage(guildId, sourceMessageId, client) {
  const result = await executor(client).query(
    `
    UPDATE media_submissions
    SET status = 'removed', updated_at = now()
    WHERE guild_id = $1
      AND source_message_id = $2
      AND status <> 'removed'
    RETURNING *
    `,
    [guildId, sourceMessageId]
  );

  return result.rows[0] || null;
}

async function replaceTags(submissionId, tagIds, client) {
  await executor(client).query(
    `
    DELETE FROM media_submission_tags
    WHERE submission_id = $1
    `,
    [submissionId]
  );

  const uniqueIds = [...new Set((tagIds || []).filter(Boolean))];

  for (const tagId of uniqueIds) {
    await executor(client).query(
      `
      INSERT INTO media_submission_tags (submission_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT (submission_id, tag_id) DO NOTHING
      `,
      [submissionId, tagId]
    );
  }
}

async function getTags(submissionId, client) {
  const result = await executor(client).query(
    `
    SELECT t.*
    FROM media_submission_tags st
    JOIN media_tags t ON t.id = st.tag_id
    WHERE st.submission_id = $1
    ORDER BY t.usage_count DESC, t.tag_name ASC
    `,
    [submissionId]
  );

  return result.rows;
}

module.exports = {
  createSubmission,
  findById,
  findBySourceMessageId,
  findByBotMessageId,
  updateBotMessageId,
  clearBotMessageId,
  saveMetadata,
  markDismissed,
  markRemovedBySourceMessage,
  replaceTags,
  getTags
};