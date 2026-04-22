CREATE TABLE IF NOT EXISTS guild_bot_settings (
  guild_id text PRIMARY KEY,
  welcome_enabled boolean NOT NULL DEFAULT true,
  welcome_channel_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_guild_bot_settings_updated_at ON guild_bot_settings;
CREATE TRIGGER trg_guild_bot_settings_updated_at
BEFORE UPDATE ON guild_bot_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS gallery_blacklist (
  guild_id text NOT NULL,
  user_id text NOT NULL,
  blacklisted_by text NOT NULL,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by text,
  removal_reason text,
  CONSTRAINT gallery_blacklist_guild_user_unique UNIQUE (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gallery_blacklist_active
  ON gallery_blacklist (guild_id, user_id)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_gallery_blacklist_updated_at ON gallery_blacklist;
CREATE TRIGGER trg_gallery_blacklist_updated_at
BEFORE UPDATE ON gallery_blacklist
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE gallery_moderation_logs
  DROP CONSTRAINT IF EXISTS gallery_moderation_logs_action_check;

ALTER TABLE gallery_moderation_logs
  ADD CONSTRAINT gallery_moderation_logs_action_check
  CHECK (action IN ('submit', 'remove', 'restore', 'blacklist', 'unblacklist'));
