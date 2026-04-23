const db = require('../client');

function executor(client) {
  return client || db;
}

async function createCycle(data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO spotlight_cycles (
      guild_id,
      month_key,
      status,
      nomination_starts_at,
      nomination_ends_at,
      voting_starts_at,
      voting_ends_at,
      announcement_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (guild_id, month_key)
    DO UPDATE SET updated_at = now()
    RETURNING *
    `,
    [
      data.guildId,
      data.monthKey,
      data.status || 'nominations',
      data.nominationStartsAt,
      data.nominationEndsAt,
      data.votingStartsAt,
      data.votingEndsAt,
      data.announcementAt
    ]
  );

  return result.rows[0] || null;
}

async function getCycleByMonth(guildId, monthKey, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM spotlight_cycles
    WHERE guild_id = $1 AND month_key = $2
    `,
    [guildId, monthKey]
  );

  return result.rows[0] || null;
}

async function getLatestCycle(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM spotlight_cycles
    WHERE guild_id = $1
    ORDER BY month_key DESC
    LIMIT 1
    `,
    [guildId]
  );

  return result.rows[0] || null;
}

async function updateCycle(cycleId, updates, client) {
  const allowed = [
    'status',
    'vote_message_id',
    'announcement_message_id',
    'winner_user_id',
    'winner_reason_tag'
  ];
  const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
  if (entries.length === 0) return getCycleById(cycleId, client);

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  const result = await executor(client).query(
    `
    UPDATE spotlight_cycles
    SET ${assignments.join(', ')}, updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [cycleId, ...values]
  );

  return result.rows[0] || null;
}

async function getCycleById(cycleId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM spotlight_cycles
    WHERE id = $1
    `,
    [cycleId]
  );

  return result.rows[0] || null;
}

async function addNomination(data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO spotlight_nominations (
      cycle_id,
      guild_id,
      nominator_user_id,
      nominee_user_id,
      reason_tag,
      reason_text
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      data.cycleId,
      data.guildId,
      data.nominatorUserId,
      data.nomineeUserId,
      data.reasonTag,
      data.reasonText
    ]
  );

  return result.rows[0] || null;
}

async function removeNomineeFromCycle(cycleId, nomineeUserId, removedBy, removedReason, client) {
  const result = await executor(client).query(
    `
    UPDATE spotlight_nominations
    SET
      status = 'removed',
      removed_by = $3,
      removed_reason = $4
    WHERE cycle_id = $1
      AND nominee_user_id = $2
      AND status = 'active'
    RETURNING *
    `,
    [cycleId, nomineeUserId, removedBy || null, removedReason || null]
  );

  return result.rows;
}

async function listActiveNominations(cycleId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM spotlight_nominations
    WHERE cycle_id = $1
      AND status = 'active'
    ORDER BY created_at ASC
    `,
    [cycleId]
  );

  return result.rows;
}

async function listTopNominees(cycleId, limit, client) {
  const result = await executor(client).query(
    `
    SELECT
      nominee_user_id,
      COUNT(*)::integer AS nomination_count,
      MIN(reason_tag) AS reason_tag
    FROM spotlight_nominations
    WHERE cycle_id = $1
      AND status = 'active'
    GROUP BY nominee_user_id
    ORDER BY nomination_count DESC, nominee_user_id ASC
    LIMIT $2
    `,
    [cycleId, limit]
  );

  return result.rows;
}

async function upsertVote(cycleId, guildId, voterUserId, nomineeUserId, client) {
  const result = await executor(client).query(
    `
    INSERT INTO spotlight_votes (
      cycle_id,
      guild_id,
      voter_user_id,
      nominee_user_id
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (cycle_id, voter_user_id)
    DO UPDATE SET
      nominee_user_id = EXCLUDED.nominee_user_id,
      updated_at = now()
    RETURNING *
    `,
    [cycleId, guildId, voterUserId, nomineeUserId]
  );

  return result.rows[0] || null;
}

async function getVoteCounts(cycleId, client) {
  const result = await executor(client).query(
    `
    SELECT
      nominee_user_id,
      COUNT(*)::integer AS vote_count
    FROM spotlight_votes
    WHERE cycle_id = $1
    GROUP BY nominee_user_id
    ORDER BY vote_count DESC, nominee_user_id ASC
    `,
    [cycleId]
  );

  return result.rows;
}

async function getUserVote(cycleId, voterUserId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM spotlight_votes
    WHERE cycle_id = $1 AND voter_user_id = $2
    `,
    [cycleId, voterUserId]
  );

  return result.rows[0] || null;
}

async function getRecentWinners(guildId, sinceMonthKey, client) {
  const result = await executor(client).query(
    `
    SELECT winner_user_id
    FROM spotlight_cycles
    WHERE guild_id = $1
      AND winner_user_id IS NOT NULL
      AND month_key >= $2
    `,
    [guildId, sinceMonthKey]
  );

  return result.rows.map(row => row.winner_user_id);
}

module.exports = {
  createCycle,
  getCycleByMonth,
  getLatestCycle,
  updateCycle,
  getCycleById,
  addNomination,
  removeNomineeFromCycle,
  listActiveNominations,
  listTopNominees,
  upsertVote,
  getVoteCounts,
  getUserVote,
  getRecentWinners
};
