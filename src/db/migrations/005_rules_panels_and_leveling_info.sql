ALTER TABLE guild_bot_settings
  ADD COLUMN IF NOT EXISTS rules_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rules_channel_id text,
  ADD COLUMN IF NOT EXISTS rules_verified_role_id text;

ALTER TABLE guild_leveling_settings
  ADD COLUMN IF NOT EXISTS info_channel_id text;
