const db = require('../client');

function executor(client) {
  return client || db;
}

async function listTags(guildId, limit = 25, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM media_tags
    WHERE guild_id = $1
    ORDER BY usage_count DESC, tag_name ASC
    LIMIT $2
    `,
    [guildId, limit]
  );

  return result.rows;
}

async function listAllTags(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM media_tags
    WHERE guild_id = $1
    ORDER BY usage_count DESC, tag_name ASC
    `,
    [guildId]
  );

  return result.rows;
}

async function findByNormalizedNames(guildId, normalizedNames, client) {
  if (!normalizedNames.length) return [];

  const result = await executor(client).query(
    `
    SELECT *
    FROM media_tags
    WHERE guild_id = $1
      AND normalized_name = ANY($2::text[])
    ORDER BY tag_name ASC
    `,
    [guildId, normalizedNames]
  );

  return result.rows;
}

async function upsertTag(guildId, tagName, normalizedName, createdBy = null, client) {
  const result = await executor(client).query(
    `
    INSERT INTO media_tags (
      guild_id,
      tag_name,
      normalized_name,
      created_by
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (guild_id, normalized_name)
    DO UPDATE SET
      tag_name = EXCLUDED.tag_name,
      updated_at = now()
    RETURNING *
    `,
    [guildId, tagName, normalizedName, createdBy]
  );

  return result.rows[0] || null;
}

async function incrementUsage(tagIds, client) {
  const uniqueIds = [...new Set((tagIds || []).filter(Boolean))];
  if (!uniqueIds.length) return;

  await executor(client).query(
    `
    UPDATE media_tags
    SET usage_count = usage_count + 1, updated_at = now()
    WHERE id = ANY($1::bigint[])
    `,
    [uniqueIds]
  );
}

module.exports = {
  listTags,
  listAllTags,
  findByNormalizedNames,
  upsertTag,
  incrementUsage
};