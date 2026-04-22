const db = require('../client');

function executor(client) {
  return client || db;
}

async function insertEvent(entry, client) {
  const result = await executor(client).query(
    `
    INSERT INTO ticket_events (
      guild_id,
      ticket_id,
      actor_id,
      action,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [
      entry.guildId,
      entry.ticketId || null,
      entry.actorId || null,
      entry.action,
      entry.metadata || null
    ]
  );

  return result.rows[0];
}

module.exports = {
  insertEvent
};
