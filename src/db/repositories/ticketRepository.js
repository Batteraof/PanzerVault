const db = require('../client');

function executor(client) {
  return client || db;
}

async function createTicket(guildId, userId, subject, client, options = {}) {
  const result = await executor(client).query(
    `
    INSERT INTO tickets (guild_id, user_id, subject, category, priority, details)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      guildId,
      userId,
      subject || null,
      options.category || 'support',
      options.priority || 'normal',
      options.details || null
    ]
  );

  return result.rows[0];
}

async function setTicketChannel(ticketId, channelId, client) {
  const result = await executor(client).query(
    `
    UPDATE tickets
    SET channel_id = $2
    WHERE id = $1
    RETURNING *
    `,
    [ticketId, channelId]
  );

  return result.rows[0] || null;
}

async function findOpenByUser(guildId, userId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM tickets
    WHERE guild_id = $1
      AND user_id = $2
      AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [guildId, userId]
  );

  return result.rows[0] || null;
}

async function findOpenByChannel(guildId, channelId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM tickets
    WHERE guild_id = $1
      AND channel_id = $2
      AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [guildId, channelId]
  );

  return result.rows[0] || null;
}

async function findById(guildId, ticketId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM tickets
    WHERE guild_id = $1 AND id = $2
    `,
    [guildId, ticketId]
  );

  return result.rows[0] || null;
}

async function closeTicket(ticketId, closedBy, reason = null, client) {
  const result = await executor(client).query(
    `
    UPDATE tickets
    SET
      status = 'closed',
      closed_at = now(),
      closed_by = $2,
      close_reason = $3
    WHERE id = $1
      AND status = 'open'
    RETURNING *
    `,
    [ticketId, closedBy || null, reason || null]
  );

  return result.rows[0] || null;
}

async function markFirstResponse(ticketId, actorId, client) {
  const result = await executor(client).query(
    `
    UPDATE tickets
    SET first_response_at = COALESCE(first_response_at, now())
    WHERE id = $1
      AND user_id <> $2
      AND status = 'open'
    RETURNING *
    `,
    [ticketId, actorId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createTicket,
  setTicketChannel,
  findOpenByUser,
  findOpenByChannel,
  findById,
  closeTicket,
  markFirstResponse
};
