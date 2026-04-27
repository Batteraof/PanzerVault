ALTER TABLE xp_audit_logs
  DROP CONSTRAINT IF EXISTS xp_audit_logs_source_type_check;

ALTER TABLE xp_audit_logs
  ADD CONSTRAINT xp_audit_logs_source_type_check
  CHECK (source_type IN (
    'text',
    'voice',
    'manual',
    'system',
    'event_rsvp',
    'event_attendance',
    'event_duration',
    'event_participation',
    'content_submission',
    'creator_reward'
  ));

ALTER TABLE guild_events
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_channel_id text,
  ADD COLUMN IF NOT EXISTS xp_rsvp integer NOT NULL DEFAULT 5 CHECK (xp_rsvp >= 0),
  ADD COLUMN IF NOT EXISTS xp_attendance integer NOT NULL DEFAULT 25 CHECK (xp_attendance >= 0),
  ADD COLUMN IF NOT EXISTS xp_duration_bonus integer NOT NULL DEFAULT 10 CHECK (xp_duration_bonus >= 0),
  ADD COLUMN IF NOT EXISTS xp_participation_bonus integer NOT NULL DEFAULT 15 CHECK (xp_participation_bonus >= 0),
  ADD COLUMN IF NOT EXISTS feedback_prompt_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_prompt_sent_at timestamptz;

ALTER TABLE IF EXISTS event_attendance
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS participation_score integer,
  ADD COLUMN IF NOT EXISTS xp_awarded integer,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE TABLE IF NOT EXISTS event_attendance (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES guild_events(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  source text NOT NULL DEFAULT 'button' CHECK (source IN ('button', 'voice', 'staff')),
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  participation_score integer NOT NULL DEFAULT 0 CHECK (participation_score >= 0),
  xp_awarded integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_attendance'
      AND column_name = 'marked_by'
  ) THEN
    EXECUTE $sql$
      UPDATE event_attendance
      SET source = CASE
        WHEN marked_by IS NOT NULL AND (source IS NULL OR source = '') THEN 'staff'
        WHEN source IS NULL OR source = '' THEN 'button'
        ELSE source
      END
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_attendance'
      AND column_name = 'attended_at'
  ) THEN
    EXECUTE $sql$
      UPDATE event_attendance
      SET checked_in_at = COALESCE(attended_at, checked_in_at, now())
    $sql$;
  END IF;
END $$;
UPDATE event_attendance
SET source = COALESCE(NULLIF(source, ''), 'button'),
    duration_seconds = COALESCE(duration_seconds, 0),
    participation_score = COALESCE(participation_score, 0),
    xp_awarded = COALESCE(xp_awarded, 0),
    checked_in_at = COALESCE(checked_in_at, now()),
    updated_at = COALESCE(updated_at, now());

ALTER TABLE event_attendance
  ALTER COLUMN source SET DEFAULT 'button',
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN duration_seconds SET DEFAULT 0,
  ALTER COLUMN duration_seconds SET NOT NULL,
  ALTER COLUMN participation_score SET DEFAULT 0,
  ALTER COLUMN participation_score SET NOT NULL,
  ALTER COLUMN xp_awarded SET DEFAULT 0,
  ALTER COLUMN xp_awarded SET NOT NULL,
  ALTER COLUMN checked_in_at SET DEFAULT now(),
  ALTER COLUMN checked_in_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE event_attendance
  DROP CONSTRAINT IF EXISTS event_attendance_source_check;

ALTER TABLE event_attendance
  ADD CONSTRAINT event_attendance_source_check
  CHECK (source IN ('button', 'voice', 'staff'));

ALTER TABLE event_attendance
  DROP CONSTRAINT IF EXISTS event_attendance_duration_seconds_check;

ALTER TABLE event_attendance
  ADD CONSTRAINT event_attendance_duration_seconds_check
  CHECK (duration_seconds >= 0);

ALTER TABLE event_attendance
  DROP CONSTRAINT IF EXISTS event_attendance_participation_score_check;

ALTER TABLE event_attendance
  ADD CONSTRAINT event_attendance_participation_score_check
  CHECK (participation_score >= 0);

ALTER TABLE event_attendance
  DROP CONSTRAINT IF EXISTS event_attendance_xp_awarded_check;

ALTER TABLE event_attendance
  ADD CONSTRAINT event_attendance_xp_awarded_check
  CHECK (xp_awarded >= 0);

CREATE INDEX IF NOT EXISTS idx_event_attendance_event
  ON event_attendance (event_id, duration_seconds DESC);

CREATE INDEX IF NOT EXISTS idx_event_attendance_user
  ON event_attendance (guild_id, user_id, checked_in_at DESC);

DROP TRIGGER IF EXISTS trg_event_attendance_updated_at ON event_attendance;
CREATE TRIGGER trg_event_attendance_updated_at
BEFORE UPDATE ON event_attendance
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS event_feedback (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES guild_events(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_feedback_event
  ON event_feedback (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS member_event_streaks (
  guild_id text NOT NULL,
  user_id text NOT NULL,
  streak_count integer NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
  best_streak_count integer NOT NULL DEFAULT 0 CHECK (best_streak_count >= 0),
  last_event_id bigint REFERENCES guild_events(id) ON DELETE SET NULL,
  last_attended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);

ALTER TABLE gallery_tags
  ADD COLUMN IF NOT EXISTS tag_type text NOT NULL DEFAULT 'general'
  CHECK (tag_type IN ('general', 'tank_type', 'map', 'mode', 'content_type'));

CREATE INDEX IF NOT EXISTS idx_gallery_tags_type
  ON gallery_tags (guild_id, tag_type, is_active, tag_name);

ALTER TABLE video_submissions
  ADD COLUMN IF NOT EXISTS creator_channel_id text,
  ADD COLUMN IF NOT EXISTS xp_awarded integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0);

CREATE TABLE IF NOT EXISTS video_submission_tags (
  id bigserial PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES video_submissions(id) ON DELETE CASCADE,
  tag_type text NOT NULL CHECK (tag_type IN ('tank_type', 'map', 'mode', 'content_type')),
  tag_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, tag_type)
);

CREATE INDEX IF NOT EXISTS idx_video_submission_tags_lookup
  ON video_submission_tags (tag_type, tag_value);

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'support'
  CHECK (category IN ('support', 'report', 'application', 'event_issue')),
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high')),
  ADD COLUMN IF NOT EXISTS details text CHECK (details IS NULL OR char_length(details) <= 1000),
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tickets_status_category
  ON tickets (guild_id, status, category, created_at DESC);
