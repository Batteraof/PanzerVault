const db = require('../client');

function executor(client) {
  return client || db;
}

async function ensureState(guildId, client) {
  await executor(client).query(
    `
    INSERT INTO community_scheduler_state (guild_id)
    VALUES ($1)
    ON CONFLICT (guild_id) DO NOTHING
    `,
    [guildId]
  );

  return getState(guildId, client);
}

async function getState(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM community_scheduler_state
    WHERE guild_id = $1
    `,
    [guildId]
  );

  return result.rows[0] || null;
}

async function updateState(guildId, updates, client) {
  const allowed = ['last_anniversary_date', 'last_weekly_recap_week'];
  const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
  if (entries.length === 0) return getState(guildId, client);

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  const result = await executor(client).query(
    `
    UPDATE community_scheduler_state
    SET ${assignments.join(', ')}, updated_at = now()
    WHERE guild_id = $1
    RETURNING *
    `,
    [guildId, ...values]
  );

  return result.rows[0] || null;
}

module.exports = {
  ensureState,
  getState,
  updateState
};
