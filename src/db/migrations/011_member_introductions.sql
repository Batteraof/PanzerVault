CREATE TABLE IF NOT EXISTS member_introductions (
  guild_id text NOT NULL,
  user_id text NOT NULL,
  channel_id text,
  message_id text,
  introduced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_introductions_recent
  ON member_introductions (guild_id, introduced_at DESC);
