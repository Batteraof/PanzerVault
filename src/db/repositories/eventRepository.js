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
      time_zone,
      starts_at,
      created_by,
      message_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      data.guildId,
      data.channelId,
      data.title,
      data.description || null,
      data.externalUrl || null,
      data.timeZone || null,
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
    'title',
    'description',
    'external_url',
    'starts_at',
    'time_zone',
    'reminder_3d_sent_at',
    'reminder_1d_sent_at',
    'cancelled_at',
    'cancelled_by',
    'cancellation_reason',
    'ends_at',
    'attendance_channel_id',
    'xp_rsvp',
    'xp_attendance',
    'xp_duration_bonus',
    'xp_participation_bonus',
    'feedback_prompt_sent_at',
    'content_prompt_sent_at',
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

async function listRsvps(eventId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM event_rsvps
    WHERE event_id = $1
    ORDER BY
      CASE status
        WHEN 'going' THEN 1
        WHEN 'maybe' THEN 2
        WHEN 'not_going' THEN 3
        ELSE 4
      END,
      updated_at ASC
    `,
    [eventId]
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

async function listRsvpsByStatuses(eventId, statuses, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM event_rsvps
    WHERE event_id = $1
      AND status = ANY($2)
    ORDER BY updated_at ASC
    `,
    [eventId, statuses]
  );

  return result.rows;
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

async function upsertAttendance(data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO event_attendance (
      event_id,
      guild_id,
      user_id,
      source,
      duration_seconds,
      participation_score,
      xp_awarded
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET
      source = EXCLUDED.source,
      duration_seconds = GREATEST(event_attendance.duration_seconds, EXCLUDED.duration_seconds),
      participation_score = GREATEST(event_attendance.participation_score, EXCLUDED.participation_score),
      xp_awarded = GREATEST(event_attendance.xp_awarded, EXCLUDED.xp_awarded),
      updated_at = now()
    RETURNING *
    `,
    [
      data.eventId,
      data.guildId,
      data.userId,
      data.source || 'button',
      data.durationSeconds || 0,
      data.participationScore || 0,
      data.xpAwarded || 0
    ]
  );

  return result.rows[0] || null;
}

async function upsertEventStreak(guildId, userId, eventId, attendedAt, client) {
  const result = await executor(client).query(
    `
    INSERT INTO member_event_streaks (
      guild_id,
      user_id,
      streak_count,
      best_streak_count,
      last_event_id,
      last_attended_at
    )
    VALUES ($1, $2, 1, 1, $3, $4)
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET
      streak_count = member_event_streaks.streak_count + 1,
      best_streak_count = GREATEST(
        member_event_streaks.best_streak_count,
        member_event_streaks.streak_count + 1
      ),
      last_event_id = EXCLUDED.last_event_id,
      last_attended_at = EXCLUDED.last_attended_at,
      updated_at = now()
    RETURNING *
    `,
    [guildId, userId, eventId, attendedAt]
  );

  return result.rows[0] || null;
}

async function listAttendance(eventId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM event_attendance
    WHERE event_id = $1
    ORDER BY duration_seconds DESC, checked_in_at ASC
    `,
    [eventId]
  );

  return result.rows;
}

async function deleteEvent(guildId, eventId, client) {
  const result = await executor(client).query(
    `
    DELETE FROM guild_events
    WHERE guild_id = $1 AND id = $2
    RETURNING *
    `,
    [guildId, eventId]
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
  deleteEvent,
  findById,
  listDueForThreeDayReminder,
  listDueForOneDayReminder,
  markCompletedBefore,
  listUpcoming,
  listRsvps,
  upsertRsvp,
  getRsvpCounts,
  listRsvpsByStatuses,
  getUserRsvp,
  upsertAttendance,
  upsertEventStreak,
  listAttendance,
  countCreatedBetween
};

