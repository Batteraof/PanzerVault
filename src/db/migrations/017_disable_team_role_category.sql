UPDATE guild_role_categories
SET is_enabled = false, updated_at = now()
WHERE category_key = 'team'
   OR command_name = 'team';
