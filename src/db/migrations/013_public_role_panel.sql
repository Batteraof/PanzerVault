ALTER TABLE guild_bot_settings
  ADD COLUMN IF NOT EXISTS role_panel_channel_id text;

ALTER TABLE guild_selectable_roles
  DROP CONSTRAINT IF EXISTS guild_selectable_roles_group_key_check;

ALTER TABLE guild_selectable_roles
  ADD CONSTRAINT guild_selectable_roles_group_key_check
  CHECK (group_key IN ('skill', 'region', 'team', 'public'));
