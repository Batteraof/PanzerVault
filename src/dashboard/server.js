require('dotenv').config();

const path = require('node:path');
const express = require('express');
const db = require('../db/client');
const logger = require('../logger');

const app = express();
const port = Number(process.env.DASHBOARD_PORT || 3000);
const publicDir = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));
app.use(express.static(publicDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

function resolveGuildId(req) {
  return req.query.guildId || process.env.GUILD_ID;
}

async function queryOne(sql, params) {
  const result = await db.query(sql, params);
  return result.rows[0] || null;
}

app.get('/api/overview', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const [activeUsers, upcomingEvents, featuredContent, openTickets, topContributors] = await Promise.all([
      queryOne(
        `
        SELECT COUNT(*)::integer AS count
        FROM users
        WHERE guild_id = $1
          AND last_activity_at >= now() - interval '30 days'
        `,
        [guildId]
      ),
      db.query(
        `
        SELECT e.*,
          COUNT(r.*) FILTER (WHERE r.status = 'going')::integer AS going_count,
          COUNT(r.*) FILTER (WHERE r.status = 'maybe')::integer AS maybe_count
        FROM guild_events e
        LEFT JOIN event_rsvps r ON r.event_id = e.id
        WHERE e.guild_id = $1
          AND e.status = 'scheduled'
          AND e.starts_at >= now()
        GROUP BY e.id
        ORDER BY e.starts_at ASC
        LIMIT 5
        `,
        [guildId]
      ),
      db.query(
        `
        SELECT id, user_id, category, caption, gallery_message_id, created_at
        FROM gallery_submissions
        WHERE guild_id = $1
          AND status = 'posted'
        ORDER BY created_at DESC
        LIMIT 6
        `,
        [guildId]
      ),
      queryOne(
        `
        SELECT COUNT(*)::integer AS count
        FROM tickets
        WHERE guild_id = $1
          AND status = 'open'
        `,
        [guildId]
      ),
      db.query(
        `
        SELECT user_id, level, total_xp, message_count, total_voice_seconds
        FROM users
        WHERE guild_id = $1
        ORDER BY total_xp DESC
        LIMIT 5
        `,
        [guildId]
      )
    ]);

    res.json({
      guildId,
      activeUsers: activeUsers ? activeUsers.count : 0,
      upcomingEvents: upcomingEvents.rows,
      featuredContent: featuredContent.rows,
      openTickets: openTickets ? openTickets.count : 0,
      topContributors: topContributors.rows
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/events', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const result = await db.query(
      `
      SELECT e.*,
        COUNT(r.*) FILTER (WHERE r.status = 'going')::integer AS going_count,
        COUNT(a.*)::integer AS attendance_count
      FROM guild_events e
      LEFT JOIN event_rsvps r ON r.event_id = e.id
      LEFT JOIN event_attendance a ON a.event_id = e.id
      WHERE e.guild_id = $1
      GROUP BY e.id
      ORDER BY e.starts_at DESC
      LIMIT 40
      `,
      [guildId]
    );

    res.json({ events: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get('/api/content', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const [gallery, videos] = await Promise.all([
      db.query(
        `
        SELECT s.*, COALESCE(json_agg(t.tag_name) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
        FROM gallery_submissions s
        LEFT JOIN gallery_submission_tags st ON st.submission_id = s.id
        LEFT JOIN gallery_tags t ON t.id = st.tag_id
        WHERE s.guild_id = $1
          AND s.status = 'posted'
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT 30
        `,
        [guildId]
      ),
      db.query(
        `
        SELECT v.*, COALESCE(json_object_agg(vt.tag_type, vt.tag_value)
          FILTER (WHERE vt.id IS NOT NULL), '{}') AS tags
        FROM video_submissions v
        LEFT JOIN video_submission_tags vt ON vt.submission_id = v.id
        WHERE v.guild_id = $1
          AND v.status = 'posted'
        GROUP BY v.id
        ORDER BY v.created_at DESC
        LIMIT 30
        `,
        [guildId]
      )
    ]);

    res.json({ gallery: gallery.rows, videos: videos.rows });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tickets', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const result = await db.query(
      `
      SELECT *,
        CASE
          WHEN first_response_at IS NOT NULL THEN EXTRACT(EPOCH FROM (first_response_at - created_at))::integer
          WHEN status = 'open' THEN EXTRACT(EPOCH FROM (now() - created_at))::integer
          ELSE NULL
        END AS response_seconds
      FROM tickets
      WHERE guild_id = $1
      ORDER BY status ASC, created_at DESC
      LIMIT 60
      `,
      [guildId]
    );

    res.json({ tickets: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get('/api/analytics', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const result = await db.query(
      `
      SELECT series.day::date,
        COALESCE(messages.count, 0)::integer AS messages,
        COALESCE(gallery.count, 0)::integer AS gallery_posts,
        COALESCE(videos.count, 0)::integer AS video_posts
      FROM generate_series(
        date_trunc('day', now() - interval '13 days'),
        date_trunc('day', now()),
        interval '1 day'
      ) AS series(day)
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count
        FROM community_message_activity
        WHERE guild_id = $1
          AND created_at >= series.day
          AND created_at < series.day + interval '1 day'
      ) messages ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count
        FROM gallery_submissions
        WHERE guild_id = $1
          AND created_at >= series.day
          AND created_at < series.day + interval '1 day'
      ) gallery ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count
        FROM video_submissions
        WHERE guild_id = $1
          AND created_at >= series.day
          AND created_at < series.day + interval '1 day'
      ) videos ON true
      ORDER BY series.day ASC
      `,
      [guildId]
    );

    res.json({ trends: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((error, req, res, next) => {
  logger.error('Dashboard request failed', error);
  res.status(500).json({ error: 'Dashboard request failed.' });
});

app.listen(port, () => {
  logger.info(`PanzerVault dashboard running on http://localhost:${port}`);
});
