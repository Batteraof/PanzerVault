const db = require('../client');

function executor(client) {
  return client || db;
}

async function upsertTag(guildId, tagName, normalizedName, allowedCategories = null, client) {
  const result = await executor(client).query(
    `
    INSERT INTO gallery_tags (
      guild_id,
      tag_name,
      normalized_name,
      allowed_categories,
      is_active
    )
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (guild_id, normalized_name)
    DO UPDATE SET
      tag_name = EXCLUDED.tag_name,
      allowed_categories = EXCLUDED.allowed_categories,
      is_active = true
    RETURNING *
    `,
    [guildId, tagName, normalizedName, allowedCategories]
  );

  return result.rows[0];
}

async function insertTagIfMissing(guildId, tagName, normalizedName, allowedCategories = null, client) {
  await executor(client).query(
    `
    INSERT INTO gallery_tags (
      guild_id,
      tag_name,
      normalized_name,
      allowed_categories,
      is_active
    )
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (guild_id, normalized_name) DO NOTHING
    `,
    [guildId, tagName, normalizedName, allowedCategories]
  );

  const result = await executor(client).query(
    `
    SELECT *
    FROM gallery_tags
    WHERE guild_id = $1 AND normalized_name = $2
    `,
    [guildId, normalizedName]
  );

  return result.rows[0] || null;
}

async function findActiveTagsByNormalizedNames(guildId, normalizedNames, category, client) {
  if (!normalizedNames.length) return [];

  const result = await executor(client).query(
    `
    SELECT *
    FROM gallery_tags
    WHERE guild_id = $1
      AND is_active = true
      AND normalized_name = ANY($2::text[])
      AND (allowed_categories IS NULL OR $3 = ANY(allowed_categories))
    `,
    [guildId, normalizedNames, category]
  );

  return result.rows;
}

async function listActiveTags(guildId, category = null, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM gallery_tags
    WHERE guild_id = $1
      AND is_active = true
      AND ($2::text IS NULL OR allowed_categories IS NULL OR $2 = ANY(allowed_categories))
    ORDER BY tag_name ASC
    `,
    [guildId, category]
  );

  return result.rows;
}

async function deactivateTag(guildId, normalizedName, client) {
  const result = await executor(client).query(
    `
    UPDATE gallery_tags
    SET is_active = false
    WHERE guild_id = $1
      AND normalized_name = $2
      AND is_active = true
    RETURNING *
    `,
    [guildId, normalizedName]
  );

  return result.rows[0] || null;
}

module.exports = {
  upsertTag,
  insertTagIfMissing,
  findActiveTagsByNormalizedNames,
  listActiveTags,
  deactivateTag
};
