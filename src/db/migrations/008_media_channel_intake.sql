ALTER TABLE guild_community_settings
  ADD COLUMN IF NOT EXISTS media_channel_id text;

CREATE TABLE IF NOT EXISTS media_submissions (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  source_message_id text NOT NULL,
  bot_message_id text,
  user_id text NOT NULL,
  media_kind text NOT NULL CHECK (media_kind IN ('image', 'video_attachment', 'video_link', 'mixed')),
  title text,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed', 'removed')),
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, source_message_id)
);

CREATE INDEX IF NOT EXISTS idx_media_submissions_guild_status
  ON media_submissions (guild_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_submissions_bot_message
  ON media_submissions (guild_id, bot_message_id);

DROP TRIGGER IF EXISTS trg_media_submissions_updated_at ON media_submissions;
CREATE TRIGGER trg_media_submissions_updated_at
BEFORE UPDATE ON media_submissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS media_tags (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  tag_name text NOT NULL,
  normalized_name text NOT NULL,
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_media_tags_lookup
  ON media_tags (guild_id, usage_count DESC, tag_name ASC);

DROP TRIGGER IF EXISTS trg_media_tags_updated_at ON media_tags;
CREATE TRIGGER trg_media_tags_updated_at
BEFORE UPDATE ON media_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS media_submission_tags (
  submission_id bigint NOT NULL REFERENCES media_submissions(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES media_tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_media_submission_tags_tag
  ON media_submission_tags (tag_id, created_at DESC);