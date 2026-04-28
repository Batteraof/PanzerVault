ALTER TABLE guild_community_settings
  ALTER COLUMN onboarding_enabled SET DEFAULT false;

UPDATE guild_community_settings
SET onboarding_enabled = false,
  updated_at = now()
WHERE onboarding_enabled = true;
