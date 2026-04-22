const db = require('../client');

function executor(client) {
  return client || db;
}

async function lockUserLimit(guildId, userId, client) {
  await executor(client).query(
    `
    INSERT INTO gallery_user_limits (guild_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (guild_id, user_id) DO NOTHING
    `,
    [guildId, userId]
  );

  const result = await executor(client).query(
    `
    SELECT *
    FROM gallery_user_limits
    WHERE guild_id = $1 AND user_id = $2
    FOR UPDATE
    `,
    [guildId, userId]
  );

  return result.rows[0];
}

async function updateLastSubmissionAt(guildId, userId, submittedAt, client) {
  const result = await executor(client).query(
    `
    UPDATE gallery_user_limits
    SET last_submission_at = $3
    WHERE guild_id = $1 AND user_id = $2
    RETURNING *
    `,
    [guildId, userId, submittedAt]
  );

  return result.rows[0] || null;
}

module.exports = {
  lockUserLimit,
  updateLastSubmissionAt
};
