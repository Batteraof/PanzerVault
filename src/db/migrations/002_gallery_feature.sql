CREATE TABLE IF NOT EXISTS gallery_settings (
  guild_id text PRIMARY KEY,
  gallery_enabled boolean NOT NULL DEFAULT true,
  showcase_channel_id text,
  meme_channel_id text,
  log_channel_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_gallery_settings_updated_at ON gallery_settings;
CREATE TRIGGER trg_gallery_settings_updated_at
BEFORE UPDATE ON gallery_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS gallery_submissions (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  category text NOT NULL CHECK (category IN ('showcase', 'meme')),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'removed')),
  caption text CHECK (caption IS NULL OR char_length(caption) <= 300),
  video_link text,
  target_channel_id text NOT NULL,
  source_interaction_or_message_ref text,
  gallery_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by text,
  removal_reason text
);

CREATE INDEX IF NOT EXISTS idx_gallery_submissions_guild_created
  ON gallery_submissions (guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_submissions_user_created
  ON gallery_submissions (guild_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_submissions_message
  ON gallery_submissions (guild_id, gallery_message_id);

CREATE INDEX IF NOT EXISTS idx_gallery_submissions_status
  ON gallery_submissions (guild_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_gallery_submissions_updated_at ON gallery_submissions;
CREATE TRIGGER trg_gallery_submissions_updated_at
BEFORE UPDATE ON gallery_submissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS gallery_assets (
  id bigserial PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES gallery_submissions(id) ON DELETE CASCADE,
  attachment_url text NOT NULL,
  filename text NOT NULL,
  content_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  display_order integer NOT NULL CHECK (display_order BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_assets_submission_order_unique UNIQUE (submission_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_gallery_assets_submission
  ON gallery_assets (submission_id, display_order);

CREATE TABLE IF NOT EXISTS gallery_tags (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  tag_name text NOT NULL,
  normalized_name text NOT NULL,
  allowed_categories text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_tags_allowed_categories_check
    CHECK (allowed_categories IS NULL OR allowed_categories <@ ARRAY['showcase', 'meme']::text[]),
  CONSTRAINT gallery_tags_guild_normalized_unique UNIQUE (guild_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_gallery_tags_active
  ON gallery_tags (guild_id, is_active, normalized_name);

DROP TRIGGER IF EXISTS trg_gallery_tags_updated_at ON gallery_tags;
CREATE TRIGGER trg_gallery_tags_updated_at
BEFORE UPDATE ON gallery_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS gallery_submission_tags (
  submission_id bigint NOT NULL REFERENCES gallery_submissions(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES gallery_tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_submission_tags_unique UNIQUE (submission_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_gallery_submission_tags_tag
  ON gallery_submission_tags (tag_id);

CREATE TABLE IF NOT EXISTS gallery_user_limits (
  guild_id text NOT NULL,
  user_id text NOT NULL,
  last_submission_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_user_limits_guild_user_unique UNIQUE (guild_id, user_id)
);

DROP TRIGGER IF EXISTS trg_gallery_user_limits_updated_at ON gallery_user_limits;
CREATE TRIGGER trg_gallery_user_limits_updated_at
BEFORE UPDATE ON gallery_user_limits
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS gallery_moderation_logs (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  submission_id bigint REFERENCES gallery_submissions(id) ON DELETE SET NULL,
  moderator_id text,
  action text NOT NULL CHECK (action IN ('submit', 'remove', 'restore')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_moderation_logs_recent
  ON gallery_moderation_logs (guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_moderation_logs_submission
  ON gallery_moderation_logs (submission_id, created_at DESC);
