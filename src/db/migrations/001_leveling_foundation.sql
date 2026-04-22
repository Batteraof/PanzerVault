CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  user_id text NOT NULL,
  guild_id text NOT NULL,
  level integer NOT NULL DEFAULT 0 CHECK (level >= 0),
  current_level_xp bigint NOT NULL DEFAULT 0 CHECK (current_level_xp >= 0),
  total_xp bigint NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  message_count bigint NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  total_voice_seconds bigint NOT NULL DEFAULT 0 CHECK (total_voice_seconds >= 0),
  streak_count integer NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
  last_activity_at timestamptz,
  last_streak_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_guild_user_unique UNIQUE (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_guild_total_xp
  ON users (guild_id, total_xp DESC, user_id);

CREATE INDEX IF NOT EXISTS idx_users_guild_level
  ON users (guild_id, level DESC, total_xp DESC);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS xp_cooldowns (
  guild_id text NOT NULL,
  user_id text NOT NULL,
  last_text_xp_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xp_cooldowns_guild_user_unique UNIQUE (guild_id, user_id)
);

DROP TRIGGER IF EXISTS trg_xp_cooldowns_updated_at ON xp_cooldowns;
CREATE TRIGGER trg_xp_cooldowns_updated_at
BEFORE UPDATE ON xp_cooldowns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS voice_sessions (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  channel_id text NOT NULL,
  joined_at timestamptz NOT NULL,
  left_at timestamptz,
  last_checked_at timestamptz NOT NULL,
  eligible_seconds integer NOT NULL DEFAULT 0 CHECK (eligible_seconds >= 0),
  awarded_xp integer NOT NULL DEFAULT 0 CHECK (awarded_xp >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'stale')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_active
  ON voice_sessions (guild_id, user_id, channel_id)
  WHERE left_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_recent
  ON voice_sessions (guild_id, user_id, joined_at DESC);

DROP TRIGGER IF EXISTS trg_voice_sessions_updated_at ON voice_sessions;
CREATE TRIGGER trg_voice_sessions_updated_at
BEFORE UPDATE ON voice_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS achievements (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  achievement_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  CONSTRAINT achievements_guild_user_key_unique UNIQUE (guild_id, user_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user
  ON achievements (guild_id, user_id, unlocked_at DESC);

CREATE TABLE IF NOT EXISTS guild_leveling_settings (
  guild_id text PRIMARY KEY,
  leveling_enabled boolean NOT NULL DEFAULT true,
  text_xp_enabled boolean NOT NULL DEFAULT true,
  voice_xp_enabled boolean NOT NULL DEFAULT true,
  levelup_channel_id text,
  dm_levelup_enabled boolean NOT NULL DEFAULT false,
  veteran_role_id text,
  veteran_lounge_channel_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_guild_leveling_settings_updated_at ON guild_leveling_settings;
CREATE TRIGGER trg_guild_leveling_settings_updated_at
BEFORE UPDATE ON guild_leveling_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS xp_audit_logs (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('text', 'voice', 'manual', 'system')),
  source_ref text,
  xp_delta integer NOT NULL,
  previous_total_xp bigint NOT NULL CHECK (previous_total_xp >= 0),
  new_total_xp bigint NOT NULL CHECK (new_total_xp >= 0),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_audit_logs_recent
  ON xp_audit_logs (guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xp_audit_logs_user_recent
  ON xp_audit_logs (guild_id, user_id, created_at DESC);
