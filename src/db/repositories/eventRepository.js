const db = require('../client');

function executor(client) {
  return client || db;
}

async function createEvent(data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO guild_events (
      guild_id,
      channel_id,
      title,
      description,
      external_url,
      starts_at,
      created_by,
      message_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      data.guildId,
      data.channelId,
      data.title,
      data.description || null,
      data.externalUrl || null,
      data.startsAt,
      data.createdBy,
      data.messageId || null
    ]
  );

  return result.rows[0] || null;
}

async function updateEvent(guildId, eventId, updates, client) {
  const allowed = [
    'message_id',
    'status',
    'reminder_3d_sent_at',
    'reminder_1d_sent_at',
    'cancelled_at',
    'cancelled_by',
    'cancellation_reason',
    'updated_at'
  ];
  const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
  if (entries.length === 0) return findById(guildId, eventId, client);

  const assignments = entries.map(([key], index) => `${key} = $${index + 3}`);
  const values = entries.map(([, value]) => value);

  const result = await executor(client).query(
    `
    UPDATE guild_events
    SET ${assignments.join(', ')}, updated_at = now()
    WHERE guild_id = $1 AND id = $2
    RETURNING *
    `,
    [guildId, eventId, ...values]
  );

  return result.rows[0] || null;
}

async function findById(guildId, eventId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_events
    WHERE guild_id = $1 AND id = $2
    `,
    [guildId, eventId]
  );

  return result.rows[0] || null;
}

async function listDueForThreeDayReminder(now, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_events
    WHERE status = 'scheduled'
      AND reminder_3d_sent_at IS NULL
      AND starts_at > $1
      AND starts_at <= $1 + interval '3 days 1 hour'
      AND starts_at > $1 + interval '2 days 23 hours'
    ORDER BY starts_at ASC
    `,
    [now]
  );

  return result.rows;
}

async function listDueForOneDayReminder(now, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_events
    WHERE status = 'scheduled'
      AND reminder_1d_sent_at IS NULL
      AND starts_at > $1
      AND starts_at <= $1 + interval '1 day 1 hour'
      AND starts_at > $1 + interval '23 hours'
    ORDER BY starts_at ASC
    `,
    [now]
  );

  return result.rows;
}

async function markCompletedBefore(now, client) {
  const result = await executor(client).query(
    `
    UPDATE guild_events
    SET status = 'completed', updated_at = now()
    WHERE status = 'scheduled'
      AND starts_at < $1
    RETURNING *
    `,
    [now]
  );

  return result.rows;
}

async function listUpcoming(guildId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM guild_events
    WHERE guild_id = $1
      AND status = 'scheduled'
      AND starts_at >= now()
    ORDER BY starts_at ASC
    `,
    [guildId]
  );

  return result.rows;
}

async function upsertRsvp(eventId, userId, status, client) {
  const result = await executor(client).query(
    `
    INSERT INTO event_rsvps (event_id, user_id, status)
    VALUES ($1, $2, $3)
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      updated_at = now()
    RETURNING *
    `,
    [eventId, userId, status]
  );

  return result.rows[0] || null;
}

async function getRsvpCounts(eventId, client) {
  const result = await executor(client).query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'going')::integer AS going_count,
      COUNT(*) FILTER (WHERE status = 'maybe')::integer AS maybe_count,
      COUNT(*) FILTER (WHERE status = 'not_going')::integer AS not_going_count
    FROM event_rsvps
    WHERE event_id = $1
    `,
    [eventId]
  );

  return result.rows[0] || {
    going_count: 0,
    maybe_count: 0,
    not_going_count: 0
  };
}

async function getUserRsvp(eventId, userId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM event_rsvps
    WHERE event_id = $1 AND user_id = $2
    `,
    [eventId, userId]
  );

  return result.rows[0] || null;
}

async function countCreatedBetween(guildId, start, end, client) {
  const result = await executor(client).query(
    `
    SELECT COUNT(*)::integer AS count
    FROM guild_events
    WHERE guild_id = $1
      AND created_at >= $2
      AND created_at < $3
    `,
    [guildId, start, end]
  );

  return result.rows[0] ? result.rows[0].count : 0;
}

module.exports = {
  createEvent,
  updateEvent,
  findById,
  listDueForThreeDayReminder,
  listDueForOneDayReminder,
  markCompletedBefore,
  listUpcoming,
  upsertRsvp,
  getRsvpCounts,
  getUserRsvp,
  countCreatedBetween
};
