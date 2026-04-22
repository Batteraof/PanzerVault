const db = require('../client');

function executor(client) {
  return client || db;
}

async function ensureUser(guildId, userId, client) {
  await executor(client).query(
    `
    INSERT INTO users (guild_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (guild_id, user_id) DO NOTHING
    `,
    [guildId, userId]
  );

  return getUser(guildId, userId, client);
}

async function getUser(guildId, userId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM users
    WHERE guild_id = $1 AND user_id = $2
    `,
    [guildId, userId]
  );

  return result.rows[0] || null;
}

async function lockUser(guildId, userId, client) {
  await ensureUser(guildId, userId, client);

  const result = await executor(client).query(
    `
    SELECT *
    FROM users
    WHERE guild_id = $1 AND user_id = $2
    FOR UPDATE
    `,
    [guildId, userId]
  );

  return result.rows[0];
}

async function updateProgress(guildId, userId, data, client) {
  const result = await executor(client).query(
    `
    UPDATE users
    SET
      level = $3,
      current_level_xp = $4,
      total_xp = $5,
      message_count = message_count + $6,
      total_voice_seconds = total_voice_seconds + $7,
      streak_count = $8,
      last_activity_at = $9,
      last_streak_at = $10
    WHERE guild_id = $1 AND user_id = $2
    RETURNING *
    `,
    [
      guildId,
      userId,
      data.level,
      data.currentLevelXp,
      data.totalXp,
      data.messageCountIncrement || 0,
      data.voiceSecondsIncrement || 0,
      data.streakCount,
      data.lastActivityAt,
      data.lastStreakAt
    ]
  );

  return result.rows[0];
}

async function incrementVoiceSeconds(guildId, userId, seconds, client) {
  if (!seconds || seconds <= 0) {
    return getUser(guildId, userId, client);
  }

  await ensureUser(guildId, userId, client);

  const result = await executor(client).query(
    `
    UPDATE users
    SET total_voice_seconds = total_voice_seconds + $3
    WHERE guild_id = $1 AND user_id = $2
    RETURNING *
    `,
    [guildId, userId, seconds]
  );

  return result.rows[0];
}

async function getRank(guildId, userId, client) {
  const result = await executor(client).query(
    `
    WITH target AS (
      SELECT total_xp
      FROM users
      WHERE guild_id = $1 AND user_id = $2
    )
    SELECT COUNT(*)::integer + 1 AS rank
    FROM users, target
    WHERE users.guild_id = $1
      AND users.total_xp > target.total_xp
    `,
    [guildId, userId]
  );

  return result.rows[0] ? result.rows[0].rank : null;
}

async function getLeaderboard(guildId, limit = 10, offset = 0, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM users
    WHERE guild_id = $1
    ORDER BY total_xp DESC, user_id ASC
    LIMIT $2 OFFSET $3
    `,
    [guildId, limit, offset]
  );

  return result.rows;
}

async function resetProgress(guildId, userId, client) {
  await ensureUser(guildId, userId, client);

  const result = await executor(client).query(
    `
    UPDATE users
    SET
      level = 0,
      current_level_xp = 0,
      total_xp = 0,
      message_count = 0,
      total_voice_seconds = 0,
      streak_count = 0,
      last_activity_at = NULL,
      last_streak_at = NULL
    WHERE guild_id = $1 AND user_id = $2
    RETURNING *
    `,
    [guildId, userId]
  );

  return result.rows[0];
}

module.exports = {
  ensureUser,
  getUser,
  lockUser,
  updateProgress,
  incrementVoiceSeconds,
  getRank,
  getLeaderboard,
  resetProgress
};
