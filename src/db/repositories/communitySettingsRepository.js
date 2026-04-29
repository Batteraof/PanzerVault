const db = require('../client');

function executor(client) {
  return client || db;
}

async function ensureSettings(guildId, defaults = {}, client) {
  await executor(client).query(
    `
    INSERT INTO guild_community_settings (
      guild_id,
      onboarding_enabled,
      community_channel_id,
      media_channel_id,
      video_enabled,
      video_channel_id,
      spotlight_enabled,
      spotlight_channel_id,
      spotlight_role_id,
      event_enabled,
      event_channel_id,
      event_role_id,
      anniversary_enabled,
      weekly_recap_enabled,
      soft_moderation_enabled,
      moderation_log_channel_id,
      coach_role_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    ON CONFLICT (guild_id)
    DO UPDATE SET
      community_channel_id = COALESCE(guild_community_settings.community_channel_id, EXCLUDED.community_channel_id),
      media_channel_id = COALESCE(guild_community_settings.media_channel_id, EXCLUDED.media_channel_id),
      video_channel_id = COALESCE(guild_community_settings.video_channel_id, EXCLUDED.video_channel_id),
      spotlight_channel_id = COALESCE(guild_community_settings.spotlight_channel_id, EXCLUDED.spotlight_channel_id),
      spotlight_role_id = COALESCE(guild_community_settings.spotlight_role_id, EXCLUDED.spotlight_role_id),
      event_channel_id = COALESCE(guild_community_settings.event_channel_id, EXCLUDED.event_channel_id),
      event_role_id = COALESCE(guild_community_settings.event_role_id, EXCLUDED.event_role_id),
      moderation_log_channel_id = COALESCE(guild_community_settings.moderation_log_channel_id, EXCLUDED.moderation_log_channel_id),
      coach_role_id = COALESCE(guild_community_settings.coach_role_id, EXCLUDED.coach_role_id)
    `,
    [
      guildId,
      defaults.onboardingEnabled ?? true,
      defaults.communityChannelId || null,
      defaults.mediaChannelId || null,
      defaults.videoEnabled ?? true,
      defaults.videoChannelId || null,
      defaults.spotlightEnabled ?? true,
      defaults.spotlightChannelId || null,
      defaults.spotlightRoleId || null,
      defaults.eventEnabled ?? true,
      defaults.eventChannelId || null,
      defaults.eventRoleId || null,
      defaults.anniversaryEnabled ?? true,
      defaults.weeklyRecapEnabled ?? true,
      defaults.softModerationEnabled ?? true,
      defaults.moderationLogChannelId || null,
      defaults.coachRoleId || null
    ]
  );

  return getSettings(guildId, client);
}

async function getSettings(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_community_settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  return result.rows[0] || null;
}

async function updateSettings(guildId, updates, client) {
  const allowed = [
    'onboarding_enabled',
    'community_channel_id',
    'media_channel_id',
    'video_enabled',
    'video_channel_id',
    'spotlight_enabled',
    'spotlight_channel_id',
    'spotlight_role_id',
    'event_enabled',
    'event_channel_id',
    'event_role_id',
    'anniversary_enabled',
    'weekly_recap_enabled',
    'weekly_recap_note',
    'soft_moderation_enabled',
    'moderation_log_channel_id',
    'coach_role_id'
  ];

  const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
  if (entries.length === 0) {
    return getSettings(guildId, client);
  }

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  const result = await executor(client).query(
    `
    UPDATE guild_community_settings
    SET ${assignments.join(', ')}, updated_at = now()
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
