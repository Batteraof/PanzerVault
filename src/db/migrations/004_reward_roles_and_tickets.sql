CREATE TABLE IF NOT EXISTS level_role_rewards (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  role_id text NOT NULL,
  required_level integer NOT NULL CHECK (required_level >= 1 AND required_level <= 500),
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by text,
  removal_reason text,
  CONSTRAINT level_role_rewards_guild_role_unique UNIQUE (guild_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_level_role_rewards_active
  ON level_role_rewards (guild_id, required_level, role_id)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_level_role_rewards_updated_at ON level_role_rewards;
CREATE TRIGGER trg_level_role_rewards_updated_at
BEFORE UPDATE ON level_role_rewards
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS level_role_reward_logs (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  role_id text NOT NULL,
  reward_id bigint REFERENCES level_role_rewards(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('assign', 'remove', 'skip')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_level_role_reward_logs_recent
  ON level_role_reward_logs (guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_level_role_reward_logs_user
  ON level_role_reward_logs (guild_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_settings (
  guild_id text PRIMARY KEY,
  tickets_enabled boolean NOT NULL DEFAULT true,
  category_channel_id text,
  log_channel_id text,
  support_role_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_ticket_settings_updated_at ON ticket_settings;
CREATE TRIGGER trg_ticket_settings_updated_at
BEFORE UPDATE ON ticket_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS tickets (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  channel_id text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  subject text CHECK (subject IS NULL OR char_length(subject) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by text,
  close_reason text CHECK (close_reason IS NULL OR char_length(close_reason) <= 300)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_one_open_per_user
  ON tickets (guild_id, user_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_tickets_channel
  ON tickets (guild_id, channel_id);

CREATE INDEX IF NOT EXISTS idx_tickets_recent
  ON tickets (guild_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;
CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS ticket_events (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  ticket_id bigint REFERENCES tickets(id) ON DELETE SET NULL,
  actor_id text,
  action text NOT NULL CHECK (action IN ('open', 'close', 'add_user', 'remove_user', 'log')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket
  ON ticket_events (ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_events_recent
  ON ticket_events (guild_id, created_at DESC);
