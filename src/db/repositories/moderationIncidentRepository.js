const db = require('../client');

function executor(client) {
  return client || db;
}

async function insertIncident(data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO soft_moderation_incidents (
      guild_id,
      user_id,
      channel_id,
      message_id,
      incident_type,
      action_taken,
      details
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [
      data.guildId,
      data.userId,
      data.channelId,
      data.messageId || null,
      data.incidentType,
      data.actionTaken,
      data.details || null
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  insertIncident
};
