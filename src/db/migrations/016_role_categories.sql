CREATE TABLE IF NOT EXISTS guild_role_categories (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  category_key text NOT NULL,
  command_name text NOT NULL,
  label text NOT NULL,
  description text,
  selection_mode text NOT NULL DEFAULT 'single' CHECK (selection_mode IN ('single', 'multiple')),
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, category_key),
  UNIQUE (guild_id, command_name)
);

ALTER TABLE guild_selectable_roles
  DROP CONSTRAINT IF EXISTS guild_selectable_roles_group_key_check;

UPDATE guild_selectable_roles
SET is_active = false, updated_at = now()
WHERE group_key = 'region'
  AND option_key IN ('uk', 'latam', 'sea');

INSERT INTO guild_role_categories (guild_id, category_key, command_name, label, description, selection_mode, sort_order)
SELECT DISTINCT guild_id, 'skill', 'skill', 'Skill Level', 'Choose your current experience level.', 'single', 10
FROM guild_selectable_roles
WHERE group_key = 'skill'
ON CONFLICT (guild_id, category_key) DO NOTHING;

INSERT INTO guild_role_categories (guild_id, category_key, command_name, label, description, selection_mode, sort_order)
SELECT DISTINCT guild_id, 'region', 'region', 'Region', 'Choose your usual play region.', 'single', 20
FROM guild_selectable_roles
WHERE group_key = 'region'
ON CONFLICT (guild_id, category_key) DO NOTHING;

INSERT INTO guild_role_categories (guild_id, category_key, command_name, label, description, selection_mode, sort_order)
SELECT DISTINCT guild_id, 'team', 'team', 'Team', 'Choose your team role.', 'single', 30
FROM guild_selectable_roles
WHERE group_key = 'team'
ON CONFLICT (guild_id, category_key) DO NOTHING;
