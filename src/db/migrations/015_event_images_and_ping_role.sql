ALTER TABLE guild_events
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE guild_community_settings
  ADD COLUMN IF NOT EXISTS event_role_id text;
