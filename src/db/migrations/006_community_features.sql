CREATE TABLE IF NOT EXISTS guild_community_settings (
  guild_id text PRIMARY KEY,
  onboarding_enabled boolean NOT NULL DEFAULT true,
  community_channel_id text,
  video_enabled boolean NOT NULL DEFAULT true,
  video_channel_id text,
  spotlight_enabled boolean NOT NULL DEFAULT true,
  spotlight_channel_id text,
  spotlight_role_id text,
  event_enabled boolean NOT NULL DEFAULT true,
  event_channel_id text,
  anniversary_enabled boolean NOT NULL DEFAULT true,
  weekly_recap_enabled boolean NOT NULL DEFAULT true,
  weekly_recap_note text,
  soft_moderation_enabled boolean NOT NULL DEFAULT true,
  moderation_log_channel_id text,
  coach_role_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guild_selectable_roles (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  group_key text NOT NULL CHECK (group_key IN ('skill', 'region')),
  option_key text NOT NULL,
  label text NOT NULL,
  role_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, group_key, option_key)
);

CREATE INDEX IF NOT EXISTS idx_guild_selectable_roles_lookup
  ON guild_selectable_roles (guild_id, group_key, is_active, sort_order);

CREATE TABLE IF NOT EXISTS guild_events (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  title text NOT NULL,
  description text,
  external_url text,
  starts_at timestamptz NOT NULL,
  created_by text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  message_id text,
  reminder_3d_sent_at timestamptz,
  reminder_1d_sent_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guild_events_schedule
  ON guild_events (guild_id, status, starts_at);

CREATE INDEX IF NOT EXISTS idx_guild_events_message
  ON guild_events (guild_id, message_id);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES guild_events(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event
  ON event_rsvps (event_id, status);

CREATE TABLE IF NOT EXISTS video_submissions (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  target_channel_id text NOT NULL,
  source_interaction_ref text,
  message_id text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'removed')),
  removed_at timestamptz,
  removed_by text,
  removal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_submissions_guild_status
  ON video_submissions (guild_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_submissions_message
  ON video_submissions (guild_id, message_id);

CREATE TABLE IF NOT EXISTS spotlight_cycles (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  month_key text NOT NULL,
  status text NOT NULL DEFAULT 'nominations' CHECK (status IN ('nominations', 'voting', 'announced')),
  nomination_starts_at timestamptz NOT NULL,
  nomination_ends_at timestamptz NOT NULL,
  voting_starts_at timestamptz NOT NULL,
  voting_ends_at timestamptz NOT NULL,
  announcement_at timestamptz NOT NULL,
  vote_message_id text,
  announcement_message_id text,
  winner_user_id text,
  winner_reason_tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_spotlight_cycles_status
  ON spotlight_cycles (guild_id, status, month_key);

CREATE TABLE IF NOT EXISTS spotlight_nominations (
  id bigserial PRIMARY KEY,
  cycle_id bigint NOT NULL REFERENCES spotlight_cycles(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  nominator_user_id text NOT NULL,
  nominee_user_id text NOT NULL,
  reason_tag text NOT NULL,
  reason_text text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  removed_by text,
  removed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, nominator_user_id)
);

CREATE INDEX IF NOT EXISTS idx_spotlight_nominations_nominee
  ON spotlight_nominations (cycle_id, nominee_user_id, status);

CREATE TABLE IF NOT EXISTS spotlight_votes (
  id bigserial PRIMARY KEY,
  cycle_id bigint NOT NULL REFERENCES spotlight_cycles(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  voter_user_id text NOT NULL,
  nominee_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, voter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_spotlight_votes_nominee
  ON spotlight_votes (cycle_id, nominee_user_id);

CREATE TABLE IF NOT EXISTS community_message_activity (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  user_id text NOT NULL,
  message_id text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  mention_count integer NOT NULL DEFAULT 0,
  link_count integer NOT NULL DEFAULT 0,
  message_length integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_message_activity_guild_created
  ON community_message_activity (guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_message_activity_user_created
  ON community_message_activity (guild_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_message_activity_channel_created
  ON community_message_activity (guild_id, channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_message_activity_hash
  ON community_message_activity (guild_id, user_id, content_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS soft_moderation_incidents (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  channel_id text NOT NULL,
  message_id text,
  incident_type text NOT NULL,
  action_taken text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soft_moderation_incidents_recent
  ON soft_moderation_incidents (guild_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_scheduler_state (
  guild_id text PRIMARY KEY,
  last_anniversary_date date,
  last_weekly_recap_week text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
