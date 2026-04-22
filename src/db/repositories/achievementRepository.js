const db = require('../client');

function executor(client) {
  return client || db;
}

async function unlockAchievement(guildId, userId, achievementKey, metadata = null, client) {
  const result = await executor(client).query(
    `
    INSERT INTO achievements (guild_id, user_id, achievement_key, metadata)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (guild_id, user_id, achievement_key) DO NOTHING
    RETURNING *
    `,
    [guildId, userId, achievementKey, metadata]
  );

  return result.rows[0] || null;
}

async function getUserAchievements(guildId, userId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM achievements
    WHERE guild_id = $1 AND user_id = $2
    ORDER BY unlocked_at DESC
    `,
    [guildId, userId]
  );

  return result.rows;
}

module.exports = {
  unlockAchievement,
  getUserAchievements
};
