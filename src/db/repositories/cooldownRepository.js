const db = require('../client');

function executor(client) {
  return client || db;
}

async function getTextCooldown(guildId, userId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM xp_cooldowns
    WHERE guild_id = $1 AND user_id = $2
    `,
    [guildId, userId]
  );

  return result.rows[0] || null;
}

async function tryAcquireTextCooldown(guildId, userId, cooldownSeconds, client) {
  const result = await executor(client).query(
    `
    INSERT INTO xp_cooldowns (guild_id, user_id, last_text_xp_at)
    VALUES ($1, $2, now())
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET last_text_xp_at = EXCLUDED.last_text_xp_at
    WHERE xp_cooldowns.last_text_xp_at <= now() - ($3::int * interval '1 second')
    RETURNING last_text_xp_at
    `,
    [guildId, userId, cooldownSeconds]
  );

  return result.rowCount === 1;
}

module.exports = {
  getTextCooldown,
  tryAcquireTextCooldown
};
