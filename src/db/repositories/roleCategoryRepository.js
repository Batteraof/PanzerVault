const db = require('../client');

function executor(client) {
  return client || db;
}

async function upsertCategory(guildId, data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO guild_role_categories (
      guild_id,
      category_key,
      command_name,
      label,
      description,
      selection_mode,
      is_enabled,
      sort_order
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (guild_id, category_key)
    DO UPDATE SET
      command_name = EXCLUDED.command_name,
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      selection_mode = EXCLUDED.selection_mode,
      is_enabled = EXCLUDED.is_enabled,
      sort_order = EXCLUDED.sort_order,
      updated_at = now()
    RETURNING *
    `,
    [
      guildId,
      data.categoryKey,
      data.commandName,
      data.label,
      data.description || null,
      data.selectionMode || 'single',
      data.isEnabled !== false,
      Number.isInteger(data.sortOrder) ? data.sortOrder : 0
    ]
  );

  return result.rows[0] || null;
}

async function listEnabled(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_role_categories
    WHERE guild_id = $1
      AND is_enabled = true
    ORDER BY sort_order ASC, label ASC
    `,
    [guildId]
  );

  return result.rows;
}

async function listAll(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_role_categories
    WHERE guild_id = $1
    ORDER BY sort_order ASC, label ASC
    `,
    [guildId]
  );

  return result.rows;
}

async function findByCommandName(guildId, commandName, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_role_categories
    WHERE guild_id = $1
      AND command_name = $2
      AND is_enabled = true
    `,
    [guildId, commandName]
  );

  return result.rows[0] || null;
}

async function findByKey(guildId, categoryKey, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_role_categories
    WHERE guild_id = $1
      AND category_key = $2
    `,
    [guildId, categoryKey]
  );

  return result.rows[0] || null;
}

async function setEnabled(guildId, categoryKey, isEnabled, client) {
  const result = await executor(client).query(
    `
    UPDATE guild_role_categories
    SET is_enabled = $3, updated_at = now()
    WHERE guild_id = $1 AND category_key = $2
    RETURNING *
    `,
    [guildId, categoryKey, isEnabled]
  );

  return result.rows[0] || null;
}

module.exports = {
  findByCommandName,
  findByKey,
  listAll,
  listEnabled,
  setEnabled,
  upsertCategory
};
