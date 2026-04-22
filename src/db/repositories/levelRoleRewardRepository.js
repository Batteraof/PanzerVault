const db = require('../client');

function executor(client) {
  return client || db;
}

async function upsertReward(guildId, roleId, requiredLevel, createdBy, client) {
  const result = await executor(client).query(
    `
    INSERT INTO level_role_rewards (
      guild_id,
      role_id,
      required_level,
      is_active,
      created_by,
      removed_at,
      removed_by,
      removal_reason
    )
    VALUES ($1, $2, $3, true, $4, NULL, NULL, NULL)
    ON CONFLICT (guild_id, role_id)
    DO UPDATE SET
      required_level = EXCLUDED.required_level,
      is_active = true,
      removed_at = NULL,
      removed_by = NULL,
      removal_reason = NULL
    RETURNING *
    `,
    [guildId, roleId, requiredLevel, createdBy || null]
  );

  return result.rows[0];
}

async function deactivateReward(guildId, roleId, removedBy, reason = null, client) {
  const result = await executor(client).query(
    `
    UPDATE level_role_rewards
    SET
      is_active = false,
      removed_at = now(),
      removed_by = $3,
      removal_reason = $4
    WHERE guild_id = $1
      AND role_id = $2
      AND is_active = true
    RETURNING *
    `,
    [guildId, roleId, removedBy || null, reason || null]
  );

  return result.rows[0] || null;
}

async function listActiveRewards(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM level_role_rewards
    WHERE guild_id = $1
      AND is_active = true
    ORDER BY required_level ASC, role_id ASC
    `,
    [guildId]
  );

  return result.rows;
}

async function insertRewardLog(entry, client) {
  const result = await executor(client).query(
    `
    INSERT INTO level_role_reward_logs (
      guild_id,
      user_id,
      role_id,
      reward_id,
      action,
      reason
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      entry.guildId,
      entry.userId,
      entry.roleId,
      entry.rewardId || null,
      entry.action,
      entry.reason || null
    ]
  );

  return result.rows[0];
}

module.exports = {
  upsertReward,
  deactivateReward,
  listActiveRewards,
  insertRewardLog
};
