const db = require('../client');

function executor(client) {
  return client || db;
}

async function ensureSettings(guildId, client) {
  await executor(client).query(
    `
    INSERT INTO ticket_settings (guild_id)
    VALUES ($1)
    ON CONFLICT (guild_id) DO NOTHING
    `,
    [guildId]
  );

  return getSettings(guildId, client);
}

async function getSettings(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM ticket_settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  return result.rows[0] || null;
}

async function updateSettings(guildId, updates, client) {
  const allowed = [
    'tickets_enabled',
    'category_channel_id',
    'log_channel_id',
    'support_role_id'
  ];
  const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));

  if (entries.length === 0) {
    return getSettings(guildId, client);
  }

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  const result = await executor(client).query(
    `
    UPDATE ticket_settings
    SET ${assignments.join(', ')}
    WHERE guild_id = $1
    RETURNING *
    `,
    [guildId, ...values]
  );

  return result.rows[0] || null;
}

module.exports = {
  ensureSettings,
  getSettings,
  updateSettings
};
