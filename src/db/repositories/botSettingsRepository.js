const db = require('../client');

function executor(client) {
  return client || db;
}

async function ensureSettings(guildId, defaults = {}, client) {
  await executor(client).query(
    `
    INSERT INTO guild_bot_settings (
      guild_id,
      welcome_channel_id,
      role_panel_channel_id,
      rules_enabled,
      rules_channel_id,
      rules_verified_role_id
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (guild_id)
    DO UPDATE SET
      welcome_channel_id = COALESCE(guild_bot_settings.welcome_channel_id, EXCLUDED.welcome_channel_id),
      role_panel_channel_id = COALESCE(guild_bot_settings.role_panel_channel_id, EXCLUDED.role_panel_channel_id),
      rules_channel_id = COALESCE(guild_bot_settings.rules_channel_id, EXCLUDED.rules_channel_id),
      rules_verified_role_id = COALESCE(guild_bot_settings.rules_verified_role_id, EXCLUDED.rules_verified_role_id)
    `,
    [
      guildId,
      defaults.welcomeChannelId || null,
      defaults.rolePanelChannelId || null,
      defaults.rulesEnabled ?? false,
      defaults.rulesChannelId || null,
      defaults.rulesVerifiedRoleId || null
    ]
  );

  return getSettings(guildId, client);
}

async function getSettings(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_bot_settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  return result.rows[0] || null;
}

async function updateSettings(guildId, updates, client) {
  const allowed = [
    'welcome_enabled',
    'welcome_channel_id',
    'role_panel_channel_id',
    'rules_enabled',
    'rules_channel_id',
    'rules_verified_role_id'
  ];
  const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));

  if (entries.length === 0) {
    return getSettings(guildId, client);
  }

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  const result = await executor(client).query(
    `
    UPDATE guild_bot_settings
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
