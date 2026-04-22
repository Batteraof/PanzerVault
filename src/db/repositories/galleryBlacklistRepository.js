const db = require('../client');

function executor(client) {
  return client || db;
}

async function getActive(guildId, userId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM gallery_blacklist
    WHERE guild_id = $1
      AND user_id = $2
      AND is_active = true
    `,
    [guildId, userId]
  );

  return result.rows[0] || null;
}

async function blacklistUser(guildId, userId, moderatorId, reason = null, client) {
  const result = await executor(client).query(
    `
    INSERT INTO gallery_blacklist (
      guild_id,
      user_id,
      blacklisted_by,
      reason,
      is_active,
      removed_at,
      removed_by,
      removal_reason
    )
    VALUES ($1, $2, $3, $4, true, NULL, NULL, NULL)
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET
      blacklisted_by = EXCLUDED.blacklisted_by,
      reason = EXCLUDED.reason,
      is_active = true,
      removed_at = NULL,
      removed_by = NULL,
      removal_reason = NULL
    RETURNING *
    `,
    [guildId, userId, moderatorId, reason]
  );

  return result.rows[0];
}

async function unblacklistUser(guildId, userId, moderatorId, reason = null, client) {
  const result = await executor(client).query(
    `
    UPDATE gallery_blacklist
    SET
      is_active = false,
      removed_at = now(),
      removed_by = $3,
      removal_reason = $4
    WHERE guild_id = $1
      AND user_id = $2
      AND is_active = true
    RETURNING *
    `,
    [guildId, userId, moderatorId, reason]
  );

  return result.rows[0] || null;
}

module.exports = {
  getActive,
  blacklistUser,
  unblacklistUser
};
