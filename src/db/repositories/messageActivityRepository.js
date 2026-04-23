const crypto = require('node:crypto');
const db = require('../client');

function executor(client) {
  return client || db;
}

function hashContent(content) {
  return crypto
    .createHash('sha1')
    .update(String(content || '').trim().toLowerCase())
    .digest('hex');
}

async function recordMessage(data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO community_message_activity (
      guild_id,
      channel_id,
      user_id,
      message_id,
      content_hash,
      mention_count,
      link_count,
      message_length
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (message_id) DO NOTHING
    RETURNING *
    `,
    [
      data.guildId,
      data.channelId,
      data.userId,
      data.messageId,
      hashContent(data.content),
      data.mentionCount,
      data.linkCount,
      data.messageLength
    ]
  );

  return result.rows[0] || null;
}

async function listRecentByUser(guildId, userId, since, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM community_message_activity
    WHERE guild_id = $1
      AND user_id = $2
      AND created_at >= $3
    ORDER BY created_at DESC
    `,
    [guildId, userId, since]
  );

  return result.rows;
}

async function countDuplicatesSince(guildId, userId, content, since, client) {
  const result = await executor(client).query(
    `
    SELECT COUNT(*)::integer AS count
    FROM community_message_activity
    WHERE guild_id = $1
      AND user_id = $2
      AND content_hash = $3
      AND created_at >= $4
    `,
    [guildId, userId, hashContent(content), since]
  );

  return result.rows[0] ? result.rows[0].count : 0;
}

async function countBetween(guildId, start, end, client) {
  const result = await executor(client).query(
    `
    SELECT COUNT(*)::integer AS count
    FROM community_message_activity
    WHERE guild_id = $1
      AND created_at >= $2
      AND created_at < $3
    `,
    [guildId, start, end]
  );

  return result.rows[0] ? result.rows[0].count : 0;
}

async function countUniqueChattersBetween(guildId, start, end, client) {
  const result = await executor(client).query(
    `
    SELECT COUNT(DISTINCT user_id)::integer AS count
    FROM community_message_activity
    WHERE guild_id = $1
      AND created_at >= $2
      AND created_at < $3
    `,
    [guildId, start, end]
  );

  return result.rows[0] ? result.rows[0].count : 0;
}

async function topChannelsBetween(guildId, start, end, limit, client) {
  const result = await executor(client).query(
    `
    SELECT channel_id, COUNT(*)::integer AS message_count
    FROM community_message_activity
    WHERE guild_id = $1
      AND created_at >= $2
      AND created_at < $3
    GROUP BY channel_id
    ORDER BY message_count DESC, channel_id ASC
    LIMIT $4
    `,
    [guildId, start, end, limit]
  );

  return result.rows;
}

async function deleteOlderThan(cutoff, client) {
  const result = await executor(client).query(
    `
    DELETE FROM community_message_activity
    WHERE created_at < $1
    `,
    [cutoff]
  );

  return result.rowCount || 0;
}

module.exports = {
  recordMessage,
  listRecentByUser,
  countDuplicatesSince,
  countBetween,
  countUniqueChattersBetween,
  topChannelsBetween,
  deleteOlderThan
};
