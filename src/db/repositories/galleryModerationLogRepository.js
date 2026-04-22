const db = require('../client');

function executor(client) {
  return client || db;
}

async function insertLog(entry, client) {
  const result = await executor(client).query(
    `
    INSERT INTO gallery_moderation_logs (
      guild_id,
      submission_id,
      moderator_id,
      action,
      reason
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [
      entry.guildId,
      entry.submissionId || null,
      entry.moderatorId || null,
      entry.action,
      entry.reason || null
    ]
  );

  return result.rows[0];
}

module.exports = {
  insertLog
};
