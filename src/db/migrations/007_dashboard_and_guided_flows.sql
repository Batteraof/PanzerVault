ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'support',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz;

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_category_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_category_check
  CHECK (category IN ('support', 'report', 'application', 'event_issue'));

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_priority_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_priority_check
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

ALTER TABLE video_submissions
  ADD COLUMN IF NOT EXISTS xp_awarded integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0);

CREATE TABLE IF NOT EXISTS video_submission_tags (
  id bigserial PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES video_submissions(id) ON DELETE CASCADE,
  tag_type text NOT NULL,
  tag_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_submission_tags_submission_type_unique UNIQUE (submission_id, tag_type)
);

CREATE INDEX IF NOT EXISTS idx_video_submission_tags_submission
  ON video_submission_tags (submission_id);

DROP TRIGGER IF EXISTS trg_video_submission_tags_updated_at ON video_submission_tags;
CREATE TRIGGER trg_video_submission_tags_updated_at
BEFORE UPDATE ON video_submission_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS event_attendance (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES guild_events(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  marked_by text,
  attended_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_attendance_event_user_unique UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendance_event
  ON event_attendance (event_id);

CREATE INDEX IF NOT EXISTS idx_event_attendance_guild_user
  ON event_attendance (guild_id, user_id, attended_at DESC);

DROP TRIGGER IF EXISTS trg_event_attendance_updated_at ON event_attendance;
CREATE TRIGGER trg_event_attendance_updated_at
BEFORE UPDATE ON event_attendance
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE xp_audit_logs
  DROP CONSTRAINT IF EXISTS xp_audit_logs_source_type_check;

ALTER TABLE xp_audit_logs
  ADD CONSTRAINT xp_audit_logs_source_type_check
  CHECK (source_type IN ('text', 'voice', 'manual', 'system', 'content_submission', 'event_attendance'));
