const db = require('../client');

function executor(client) {
  return client || db;
}

async function ensureSettings(guildId, defaults = {}, client) {
  await executor(client).query(
    `
    INSERT INTO gallery_settings (
      guild_id,
      showcase_channel_id,
      meme_channel_id,
      log_channel_id
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (guild_id)
    DO UPDATE SET
      showcase_channel_id = COALESCE(gallery_settings.showcase_channel_id, EXCLUDED.showcase_channel_id),
      meme_channel_id = COALESCE(gallery_settings.meme_channel_id, EXCLUDED.meme_channel_id),
      log_channel_id = COALESCE(gallery_settings.log_channel_id, EXCLUDED.log_channel_id)
    `,
    [
      guildId,
      defaults.showcaseChannelId || null,
      defaults.memeChannelId || null,
      defaults.logChannelId || null
    ]
  );

  return getSettings(guildId, client);
}

async function getSettings(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM gallery_settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  return result.rows[0] || null;
}

async function updateSettings(guildId, updates, client) {
  const allowed = [
    'gallery_enabled',
    'showcase_channel_id',
    'meme_channel_id',
    'log_channel_id'
  ];

  const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
  if (entries.length === 0) {
    return getSettings(guildId, client);
  }

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  const result = await executor(client).query(
    `
    UPDATE gallery_settings
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
