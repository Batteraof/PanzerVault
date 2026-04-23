const db = require('../client');

function executor(client) {
  return client || db;
}

function normalizeEnsureArgs(defaultsOrClient, maybeClient) {
  if (defaultsOrClient && typeof defaultsOrClient.query === 'function') {
    return {
      defaults: {},
      client: defaultsOrClient
    };
  }

  return {
    defaults: defaultsOrClient || {},
    client: maybeClient
  };
}

async function ensureSettings(guildId, defaults = {}, client) {
  const normalized = normalizeEnsureArgs(defaults, client);

  await executor(normalized.client).query(
    `
    INSERT INTO guild_leveling_settings (guild_id, info_channel_id)
    VALUES ($1, $2)
    ON CONFLICT (guild_id)
    DO UPDATE SET
      info_channel_id = COALESCE(guild_leveling_settings.info_channel_id, EXCLUDED.info_channel_id)
    `,
    [guildId, normalized.defaults.infoChannelId || null]
  );

  return getSettings(guildId, normalized.client);
}

async function getSettings(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_leveling_settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  return result.rows[0] || null;
}

async function updateSettings(guildId, updates, client) {
  const allowed = [
    'leveling_enabled',
    'text_xp_enabled',
    'voice_xp_enabled',
    'levelup_channel_id',
    'info_channel_id',
    'dm_levelup_enabled',
    'veteran_role_id',
    'veteran_lounge_channel_id'
  ];

  const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
  if (entries.length === 0) {
    return getSettings(guildId, client);
  }

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  const result = await executor(client).query(
    `
    UPDATE guild_leveling_settings
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
