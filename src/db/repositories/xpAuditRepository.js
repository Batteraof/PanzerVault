const db = require('../client');

function executor(client) {
  return client || db;
}

async function insertAuditLog(entry, client) {
  const result = await executor(client).query(
    `
    INSERT INTO xp_audit_logs (
      guild_id,
      user_id,
      source_type,
      source_ref,
      xp_delta,
      previous_total_xp,
      new_total_xp,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      entry.guildId,
      entry.userId,
      entry.sourceType,
      entry.sourceRef || null,
      entry.xpDelta,
      entry.previousTotalXp,
      entry.newTotalXp,
      entry.metadata || null
    ]
  );

  return result.rows[0];
}

async function getRecentAudits(guildId, limit = 50, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM xp_audit_logs
    WHERE guild_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [guildId, limit]
  );

  return result.rows;
}

module.exports = {
  insertAuditLog,
  getRecentAudits
};
