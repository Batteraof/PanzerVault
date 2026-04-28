const db = require('../client');

async function getIntroduction(guildId, userId, client) {
  const executor = client || db;
  const result = await executor.query(
    `
    SELECT *
    FROM member_introductions
    WHERE guild_id = $1 AND user_id = $2
    `,
    [guildId, userId]
  );

  return result.rows[0] || null;
}

async function reserveIntroduction(guildId, userId, client) {
  const executor = client || db;
  const result = await executor.query(
    `
    INSERT INTO member_introductions (guild_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (guild_id, user_id) DO NOTHING
    RETURNING *
    `,
    [guildId, userId]
  );

  return result.rows[0] || null;
}

async function markIntroductionPosted(guildId, userId, channelId, messageId, client) {
  const executor = client || db;
  const result = await executor.query(
    `
    UPDATE member_introductions
    SET channel_id = $3,
      message_id = $4,
      introduced_at = now()
    WHERE guild_id = $1 AND user_id = $2
    RETURNING *
    `,
    [guildId, userId, channelId, messageId]
  );

  return result.rows[0] || null;
}

async function releaseIntroduction(guildId, userId, client) {
  const executor = client || db;
  await executor.query(
    `
    DELETE FROM member_introductions
    WHERE guild_id = $1 AND user_id = $2
    `,
    [guildId, userId]
  );
}

module.exports = {
  getIntroduction,
  markIntroductionPosted,
  releaseIntroduction,
  reserveIntroduction
};
