const db = require('../client');

function executor(client) {
  return client || db;
}

async function startSession({ guildId, userId, channelId, joinedAt }, client) {
  const result = await executor(client).query(
    `
    INSERT INTO voice_sessions (
      guild_id,
      user_id,
      channel_id,
      joined_at,
      last_checked_at,
      status
    )
    VALUES ($1, $2, $3, $4, $4, 'active')
    RETURNING *
    `,
    [guildId, userId, channelId, joinedAt]
  );

  return result.rows[0];
}

async function getActiveSessions(client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM voice_sessions
    WHERE left_at IS NULL AND status = 'active'
    ORDER BY joined_at ASC
    `
  );

  return result.rows;
}

async function findOpenSessionForUser(guildId, userId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM voice_sessions
    WHERE guild_id = $1
      AND user_id = $2
      AND left_at IS NULL
      AND status = 'active'
    ORDER BY joined_at DESC
    LIMIT 1
    `,
    [guildId, userId]
  );

  return result.rows[0] || null;
}

async function lockSession(id, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM voice_sessions
    WHERE id = $1
    FOR UPDATE
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function addEligibleSeconds(id, seconds, checkedAt, client) {
  const result = await executor(client).query(
    `
    UPDATE voice_sessions
    SET eligible_seconds = eligible_seconds + $2,
        last_checked_at = $3
    WHERE id = $1
    RETURNING *
    `,
    [id, seconds, checkedAt]
  );

  return result.rows[0];
}

async function markChecked(id, checkedAt, client) {
  const result = await executor(client).query(
    `
    UPDATE voice_sessions
    SET last_checked_at = $2
    WHERE id = $1
    RETURNING *
    `,
    [id, checkedAt]
  );

  return result.rows[0];
}

async function addAwardedXp(id, xp, client) {
  const result = await executor(client).query(
    `
    UPDATE voice_sessions
    SET awarded_xp = awarded_xp + $2
    WHERE id = $1
    RETURNING *
    `,
    [id, xp]
  );

  return result.rows[0];
}

async function closeSession(id, leftAt, status = 'closed', client) {
  const result = await executor(client).query(
    `
    UPDATE voice_sessions
    SET left_at = COALESCE(left_at, $2),
        status = $3
    WHERE id = $1
    RETURNING *
    `,
    [id, leftAt, status]
  );

  return result.rows[0] || null;
}

async function closeOpenSessionsForUser(guildId, userId, leftAt, status = 'stale', client) {
  const result = await executor(client).query(
    `
    UPDATE voice_sessions
    SET left_at = COALESCE(left_at, $3),
        status = $4
    WHERE guild_id = $1
      AND user_id = $2
      AND left_at IS NULL
      AND status = 'active'
    RETURNING *
    `,
    [guildId, userId, leftAt, status]
  );

  return result.rows;
}

module.exports = {
  startSession,
  getActiveSessions,
  findOpenSessionForUser,
  lockSession,
  addEligibleSeconds,
  markChecked,
  addAwardedXp,
  closeSession,
  closeOpenSessionsForUser
};
