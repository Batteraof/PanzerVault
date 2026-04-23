const db = require('../client');

function executor(client) {
  return client || db;
}

async function upsertRoleOption(guildId, groupKey, optionKey, label, roleId, sortOrder, client) {
  const result = await executor(client).query(
    `
    INSERT INTO guild_selectable_roles (
      guild_id,
      group_key,
      option_key,
      label,
      role_id,
      sort_order,
      is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, true)
    ON CONFLICT (guild_id, group_key, option_key)
    DO UPDATE SET
      label = EXCLUDED.label,
      role_id = EXCLUDED.role_id,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      updated_at = now()
    RETURNING *
    `,
    [guildId, groupKey, optionKey, label, roleId, sortOrder]
  );

  return result.rows[0] || null;
}

async function deactivateRoleOption(guildId, groupKey, optionKey, client) {
  const result = await executor(client).query(
    `
    UPDATE guild_selectable_roles
    SET is_active = false, updated_at = now()
    WHERE guild_id = $1 AND group_key = $2 AND option_key = $3
    RETURNING *
    `,
    [guildId, groupKey, optionKey]
  );

  return result.rows[0] || null;
}

async function listActiveByGroup(guildId, groupKey, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_selectable_roles
    WHERE guild_id = $1
      AND group_key = $2
      AND is_active = true
    ORDER BY sort_order ASC, label ASC
    `,
    [guildId, groupKey]
  );

  return result.rows;
}

async function listAllActive(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_selectable_roles
    WHERE guild_id = $1
      AND is_active = true
    ORDER BY group_key ASC, sort_order ASC, label ASC
    `,
    [guildId]
  );

  return result.rows;
}

module.exports = {
  upsertRoleOption,
  deactivateRoleOption,
  listActiveByGroup,
  listAllActive
};
