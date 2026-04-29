require('dotenv').config();

const path = require('node:path');
const express = require('express');
const db = require('../db/client');
const eventRepository = require('../db/repositories/eventRepository');
const botSettingsRepository = require('../db/repositories/botSettingsRepository');
const guildSettingsRepository = require('../db/repositories/guildSettingsRepository');
const gallerySettingsRepository = require('../db/repositories/gallerySettingsRepository');
const logger = require('../logger');
const botSettingsService = require('../modules/config/services/botSettingsService');
const communitySettingsService = require('../modules/config/services/communitySettingsService');
const onboardingRoleService = require('../modules/config/services/onboardingRoleService');
const teamRoleService = require('../modules/config/services/teamRoleService');
const publicRoleService = require('../modules/config/services/publicRoleService');
const roleCategoryService = require('../modules/config/services/roleCategoryService');
const gallerySettingsService = require('../modules/gallery/services/gallerySettingsService');
const galleryTagService = require('../modules/gallery/services/galleryTagService');
const ticketSettingsService = require('../modules/tickets/services/ticketSettingsService');
const rewardRoleService = require('../modules/rewards/services/rewardRoleService');
const readinessService = require('../modules/system/services/readinessService');
const eventService = require('../modules/community/services/eventService');
const { buildWelcomePayload } = require('../lib/welcomeMessage');
const { parseDateTimeInTimeZone, parseLocalDateTimeString } = require('../modules/community/utils/dateUtils');

const app = express();
const port = Number(process.env.DASHBOARD_PORT || 3000);
const host = process.env.DASHBOARD_HOST || '127.0.0.1';
const dashboardUsername = process.env.DASHBOARD_USERNAME || 'admin';
const dashboardPassword = process.env.DASHBOARD_PASSWORD || '';
const publicDir = path.join(__dirname, 'public');
const discordApiBase = 'https://discord.com/api/v10';
const memberCache = new Map();
const guildMetadataCache = new Map();
const MEMBER_CACHE_TTL_MS = 10 * 60 * 1000;
const GUILD_METADATA_TTL_MS = 5 * 60 * 1000;
const MAX_MEMBER_LOOKUPS_PER_REQUEST = 24;

app.disable('x-powered-by');
app.use(requireDashboardAuth);
app.use(express.json({ limit: '128kb' }));
app.use(express.static(publicDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

function normalizeIp(ip = '') {
  return String(ip).replace(/^::ffff:/, '');
}

function isLoopbackRequest(req) {
  const remoteAddress = normalizeIp(req.ip || req.socket?.remoteAddress || '');
  return remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === 'localhost';
}

function parseBasicAuth(header = '') {
  if (!header.startsWith('Basic ')) return null;

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator === -1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch (error) {
    return null;
  }
}

function requireDashboardAuth(req, res, next) {
  if (!dashboardPassword) {
    if (isLoopbackRequest(req)) {
      return next();
    }

    return res
      .status(403)
      .send('Dashboard access is restricted to localhost until DASHBOARD_PASSWORD is set.');
  }

  const credentials = parseBasicAuth(req.headers.authorization || '');
  if (
    credentials &&
    credentials.username === dashboardUsername &&
    credentials.password === dashboardPassword
  ) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="PanzerVault Bot Dashboard", charset="UTF-8"');
  return res.status(401).send('Authentication required.');
}

function resolveGuildId(req) {
  return req.query.guildId || process.env.GUILD_ID;
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function gatewayError(message) {
  const error = new Error(message);
  error.statusCode = 502;
  return error;
}

async function queryOne(sql, params) {
  const result = await db.query(sql, params);
  return result.rows[0] || null;
}

function cacheKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function fallbackProfile(userId) {
  const safeId = String(userId || 'unknown');
  return {
    userId: safeId,
    displayName: `Member ${safeId.slice(-4)}`,
    username: null
  };
}

function normalizeProfile(userId, payload = {}) {
  const user = payload.user || {};
  const fallback = fallbackProfile(userId);
  return {
    userId: String(userId),
    displayName: payload.nick || user.global_name || user.username || fallback.displayName,
    username: user.username || null
  };
}

function getCachedProfile(guildId, userId) {
  const cached = memberCache.get(cacheKey(guildId, userId));
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    memberCache.delete(cacheKey(guildId, userId));
    return null;
  }
  return cached.profile;
}

function cacheProfile(guildId, profile) {
  memberCache.set(cacheKey(guildId, profile.userId), {
    expiresAt: Date.now() + MEMBER_CACHE_TTL_MS,
    profile
  });
  return profile;
}

async function discordRequest(route, options = {}) {
  if (!process.env.TOKEN) {
    throw gatewayError('Dashboard cannot reach Discord because TOKEN is missing.');
  }

  const method = options.method || 'GET';
  const response = await fetch(`${discordApiBase}${route}`, {
    method,
    headers: {
      Authorization: `Bot ${process.env.TOKEN}`,
      'User-Agent': 'PanzerVaultBotDashboard/1.0',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 404 && options.allowNotFound) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw gatewayError(`Discord API ${method} ${route} failed (${response.status}). ${text.slice(0, 180)}`.trim());
  }

  if (response.status === 204) return null;
  return response.json();
}

async function fetchMemberProfile(guildId, userId) {
  try {
    const payload = await discordRequest(`/guilds/${guildId}/members/${userId}`, {
      allowNotFound: true
    });

    if (!payload) {
      return cacheProfile(guildId, fallbackProfile(userId));
    }

    return cacheProfile(guildId, normalizeProfile(userId, payload));
  } catch (error) {
    logger.warn(`Dashboard member lookup failed for ${userId}`, error);
    return cacheProfile(guildId, fallbackProfile(userId));
  }
}

async function resolveMemberProfiles(guildId, userIds, limit = MAX_MEMBER_LOOKUPS_PER_REQUEST) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean).map(value => String(value)))];
  const profiles = new Map();
  const pending = [];

  for (const userId of uniqueIds) {
    const cached = getCachedProfile(guildId, userId);
    if (cached) {
      profiles.set(userId, cached);
      continue;
    }

    if (pending.length < limit) {
      pending.push(userId);
      continue;
    }

    profiles.set(userId, fallbackProfile(userId));
  }

  const fetched = await Promise.all(pending.map(userId => fetchMemberProfile(guildId, userId)));
  fetched.forEach(profile => {
    profiles.set(profile.userId, profile);
  });

  return profiles;
}

function decorateRowsWithProfiles(rows, profileMap, userField = 'user_id') {
  return rows.map(row => {
    const userId = row[userField] ? String(row[userField]) : null;
    const profile = userId ? profileMap.get(userId) || fallbackProfile(userId) : null;
    return {
      ...row,
      display_name: profile ? profile.displayName : null,
      username: profile ? profile.username : null
    };
  });
}

function emptyGuildMetadata(error = null) {
  return {
    channels: [],
    categories: [],
    roles: [],
    error
  };
}

async function fetchGuildMetadata(guildId) {
  if (!guildId) {
    return emptyGuildMetadata('Dashboard guild metadata is unavailable because no guild is configured.');
  }

  const cached = guildMetadataCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const [channelsRaw, rolesRaw] = await Promise.all([
      discordRequest(`/guilds/${guildId}/channels`),
      discordRequest(`/guilds/${guildId}/roles`)
    ]);

    const categoryMap = new Map(
      channelsRaw
        .filter(channel => channel.type === 4)
        .map(channel => [channel.id, channel])
    );

    const categories = [...categoryMap.values()]
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position || 0,
        label: channel.name
      }))
      .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label));

    const channels = channelsRaw
      .filter(channel => channel.type === 0 || channel.type === 5)
      .map(channel => {
        const parent = channel.parent_id ? categoryMap.get(channel.parent_id) : null;
        return {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          position: channel.position || 0,
          categoryPosition: parent ? parent.position || 0 : -1,
          categoryName: parent ? parent.name : null,
          label: parent ? `${parent.name} / #${channel.name}` : `#${channel.name}`
        };
      })
      .sort((left, right) =>
        left.categoryPosition - right.categoryPosition ||
        left.position - right.position ||
        left.label.localeCompare(right.label)
      );

    const roles = rolesRaw
      .filter(role => role.id !== guildId && !role.managed)
      .sort((left, right) => right.position - left.position || left.name.localeCompare(right.name))
      .map(role => ({
        id: role.id,
        name: role.name,
        label: `@${role.name}`,
        position: role.position
      }));

    const value = { channels, categories, roles, error: null };
    guildMetadataCache.set(guildId, {
      expiresAt: Date.now() + GUILD_METADATA_TTL_MS,
      value
    });
    return value;
  } catch (error) {
    logger.warn(`Dashboard guild metadata lookup failed for ${guildId}`, error);
    if (cached && cached.value) {
      return {
        ...cached.value,
        error: 'Discord metadata could not be refreshed just now. Using the most recent cached channels and roles.'
      };
    }

    return emptyGuildMetadata('Discord metadata is temporarily unavailable. Check the bot permissions and try refreshing again.');
  }
}
function roleMapFromRows(rows) {
  return Object.fromEntries((rows || []).map(row => [row.option_key, row.role_id]));
}

function serializeSelectableRoles(rows) {
  return (rows || []).map(row => ({
    optionKey: row.option_key,
    label: row.label,
    roleId: row.role_id,
    sortOrder: row.sort_order,
    emoji: row.emoji || ''
  }));
}

function asNullableId(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function parseEventDateInput(value) {
  const normalized = String(value || '').trim().replace('T', ' ');
  return parseLocalDateTimeString(normalized);
}

async function serializeRoleCategories(guildId, categories) {
  const result = [];
  for (const category of categories || []) {
    const options = await roleCategoryService.listCategoryOptions(guildId, category.category_key);
    result.push({
      categoryKey: category.category_key,
      commandName: category.command_name,
      label: category.label,
      description: category.description || '',
      selectionMode: category.selection_mode,
      isEnabled: category.is_enabled,
      sortOrder: category.sort_order,
      options: serializeSelectableRoles(options)
    });
  }
  return result;
}

function serverTimeZone() {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function parseEventDateInputForZone(value, timeZone) {
  const normalized = String(value || '').trim().replace('T', ' ');
  return timeZone ? parseDateTimeInTimeZone(normalized, timeZone) : parseEventDateInput(normalized);
}

function toOptionalBoolean(value) {
  return typeof value === 'boolean' ? value : undefined;
}

function parseRequiredLevel(value) {
  const level = Number(value);
  if (!Number.isInteger(level) || level < 1 || level > 500) {
    throw badRequest('Reward level must be a whole number between 1 and 500.');
  }
  return level;
}

function buildBotUpdates(body = {}) {
  const updates = {};
  const flagKeys = {
    welcomeEnabled: 'welcome_enabled'
  };

  for (const [inputKey, dbKey] of Object.entries(flagKeys)) {
    const value = toOptionalBoolean(body[inputKey]);
    if (value !== undefined) {
      updates[dbKey] = value;
    }
  }

  const idKeys = {
    welcomeChannelId: 'welcome_channel_id',
    rolePanelChannelId: 'role_panel_channel_id'
  };

  for (const [inputKey, dbKey] of Object.entries(idKeys)) {
    if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
      updates[dbKey] = asNullableId(body[inputKey]);
    }
  }

  return updates;
}

function buildLevelingUpdates(body = {}) {
  const updates = {};
  const flagKeys = {
    levelingEnabled: 'leveling_enabled',
    textXpEnabled: 'text_xp_enabled',
    voiceXpEnabled: 'voice_xp_enabled',
    dmLevelupEnabled: 'dm_levelup_enabled'
  };

  for (const [inputKey, dbKey] of Object.entries(flagKeys)) {
    const value = toOptionalBoolean(body[inputKey]);
    if (value !== undefined) {
      updates[dbKey] = value;
    }
  }

  const idKeys = {
    levelupChannelId: 'levelup_channel_id',
    infoChannelId: 'info_channel_id'
  };

  for (const [inputKey, dbKey] of Object.entries(idKeys)) {
    if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
      updates[dbKey] = asNullableId(body[inputKey]);
    }
  }

  return updates;
}

function buildCommunityUpdates(body = {}) {
  const updates = {};
  const flagKeys = {
    onboardingEnabled: 'onboarding_enabled',
    videoEnabled: 'video_enabled',
    spotlightEnabled: 'spotlight_enabled',
    eventEnabled: 'event_enabled',
    anniversaryEnabled: 'anniversary_enabled',
    weeklyRecapEnabled: 'weekly_recap_enabled',
    softModerationEnabled: 'soft_moderation_enabled'
  };

  for (const [inputKey, dbKey] of Object.entries(flagKeys)) {
    const value = toOptionalBoolean(body[inputKey]);
    if (value !== undefined) {
      updates[dbKey] = value;
    }
  }

  const idKeys = {
    communityChannelId: 'community_channel_id',
    mediaChannelId: 'media_channel_id',
    videoChannelId: 'video_channel_id',
    spotlightChannelId: 'spotlight_channel_id',
    spotlightRoleId: 'spotlight_role_id',
    eventChannelId: 'event_channel_id',
    eventRoleId: 'event_role_id',
    moderationLogChannelId: 'moderation_log_channel_id'
  };

  for (const [inputKey, dbKey] of Object.entries(idKeys)) {
    if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
      updates[dbKey] = asNullableId(body[inputKey]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'weeklyRecapNote')) {
    const note = String(body.weeklyRecapNote || '').trim();
    if (note.length > 300) {
      throw badRequest('Weekly recap note must be 300 characters or less.');
    }
    updates.weekly_recap_note = note || null;
  }

  return updates;
}

function galleryCategoriesFromInput(value) {
  if (!value || value === 'all') return null;
  if (!['showcase', 'meme'].includes(value)) {
    throw badRequest('Gallery tag category must be all, showcase, or meme.');
  }
  return [value];
}

function buildGalleryUpdates(body = {}) {
  const updates = {};
  const galleryEnabled = toOptionalBoolean(body.galleryEnabled);
  if (galleryEnabled !== undefined) {
    updates.gallery_enabled = galleryEnabled;
  }

  const idKeys = {
    showcaseChannelId: 'showcase_channel_id',
    memeChannelId: 'meme_channel_id',
    galleryLogChannelId: 'log_channel_id'
  };

  for (const [inputKey, dbKey] of Object.entries(idKeys)) {
    if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
      updates[dbKey] = asNullableId(body[inputKey]);
    }
  }

  return updates;
}

function buildTicketUpdates(body = {}) {
  const updates = {};
  const ticketsEnabled = toOptionalBoolean(body.ticketsEnabled);
  if (ticketsEnabled !== undefined) {
    updates.tickets_enabled = ticketsEnabled;
  }

  const idKeys = {
    ticketCategoryId: 'category_channel_id',
    ticketLogChannelId: 'log_channel_id',
    supportRoleId: 'support_role_id'
  };

  for (const [inputKey, dbKey] of Object.entries(idKeys)) {
    if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
      updates[dbKey] = asNullableId(body[inputKey]);
    }
  }

  return updates;
}

function serializeMessagePayload(payload) {
  return {
    ...payload,
    embeds: (payload.embeds || []).map(embed => typeof embed.toJSON === 'function' ? embed.toJSON() : embed),
    components: (payload.components || []).map(row => typeof row.toJSON === 'function' ? row.toJSON() : row),
    allowed_mentions: { parse: [] }
  };
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    guildId: resolveGuildId(req),
    timestamp: new Date().toISOString()
  });
});

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
        ORDER BY total_xp DESC, user_id ASC
        LIMIT 5
        `,
        [guildId]
      )
    ]);

    const profileMap = await resolveMemberProfiles(guildId, [
      ...featuredContent.rows.map(row => row.user_id),
      ...topContributors.rows.map(row => row.user_id)
    ]);

    res.json({
      guildId,
      activeUsers: activeUsers ? activeUsers.count : 0,
      upcomingEvents: upcomingEvents.rows,
      featuredContent: decorateRowsWithProfiles(featuredContent.rows, profileMap),
      openTickets: openTickets ? openTickets.count : 0,
      topContributors: decorateRowsWithProfiles(topContributors.rows, profileMap)
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
        COUNT(r.*) FILTER (WHERE r.status = 'maybe')::integer AS maybe_count,
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

app.post('/api/events', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const settings = await communitySettingsService.ensureGuildSettings(guildId);
    if (!settings.event_enabled) {
      throw badRequest('Events are currently disabled in community settings.');
    }

    if (!settings.event_channel_id) {
      throw badRequest('Set the event channel in dashboard settings before creating an event.');
    }

    const title = String(req.body.title || '').trim();
    if (title.length < 3) {
      throw badRequest('Event title must be at least 3 characters long.');
    }

    const timeZone = String(req.body.timeZone || serverTimeZone()).trim();
    const startsAt = parseEventDateInputForZone(req.body.startsAt, timeZone);
    if (!startsAt) {
      throw badRequest(`Use a valid date and time for the event start in ${timeZone || 'server local time'}.`);
    }

    if (startsAt.getTime() <= Date.now()) {
      throw badRequest('Event time must be in the future.');
    }

    const externalUrl = eventService.validateLink(req.body.externalUrl || null);
    const imageUrl = eventService.validateImageUrl(req.body.imageUrl || null);
    const description = String(req.body.description || '').trim() || null;

    const created = await eventRepository.createEvent({
      guildId,
      channelId: settings.event_channel_id,
      title,
      description,
      externalUrl,
      imageUrl,
      timeZone,
      startsAt,
      createdBy: 'dashboard'
    });

    try {
      const counts = {
        going_count: 0,
        maybe_count: 0,
        not_going_count: 0
      };

      const payload = {
        content: eventService.buildEventAnnouncementContent(settings),
        embeds: [eventService.buildEventEmbed(created, counts).toJSON()],
        components: eventService.buildEventComponents(created).map(row => row.toJSON()),
        allowed_mentions: eventService.eventAllowedMentions(settings)
      };

      const message = await discordRequest(`/channels/${created.channel_id}/messages`, {
        method: 'POST',
        body: payload
      });

      const updated = await eventRepository.updateEvent(guildId, created.id, {
        message_id: message.id
      });

      res.status(201).json({ event: updated, messageId: message.id });
    } catch (error) {
      await eventRepository.deleteEvent(guildId, created.id).catch(() => null);
      throw error;
    }
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

    const profileMap = await resolveMemberProfiles(guildId, [
      ...gallery.rows.map(row => row.user_id),
      ...videos.rows.map(row => row.user_id)
    ]);

    res.json({
      gallery: decorateRowsWithProfiles(gallery.rows, profileMap),
      videos: decorateRowsWithProfiles(videos.rows, profileMap)
    });
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

    const profileMap = await resolveMemberProfiles(guildId, result.rows.map(row => row.user_id));
    res.json({ tickets: decorateRowsWithProfiles(result.rows, profileMap) });
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

app.get('/api/settings', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const [
      botSettings,
      communitySettings,
      gallerySettings,
      ticketSettings,
      levelingSettings,
      rewardRoles,
      galleryTags,
      skillRoles,
      regionRoles,
      teamRoles,
      publicRoles,
      roleCategories,
      metadata
    ] = await Promise.all([
      botSettingsService.ensureGuildSettings(guildId),
      communitySettingsService.ensureGuildSettings(guildId),
      gallerySettingsService.ensureGuildSettings(guildId),
      ticketSettingsService.ensureGuildSettings(guildId),
      guildSettingsRepository.ensureSettings(guildId),
      rewardRoleService.listRewards(guildId),
      galleryTagService.listTags(guildId),
      onboardingRoleService.listRolesByGroup(guildId, 'skill'),
      onboardingRoleService.listRolesByGroup(guildId, 'region'),
      teamRoleService.listTeamRoles(guildId),
      publicRoleService.listPublicRoles(guildId),
      roleCategoryService.listCategories(guildId, { includeDisabled: true }),
      fetchGuildMetadata(guildId)
    ]);

    const onboarding = {
      skillRoles: roleMapFromRows(skillRoles),
      regionRoles: roleMapFromRows(regionRoles)
    };

    const readiness = readinessService.buildReadinessReport({
      guildId,
      botSettings,
      communitySettings,
      gallerySettings,
      ticketSettings,
      levelingSettings,
      skillRoles: onboarding.skillRoles,
      regionRoles: onboarding.regionRoles,
      metadata
    });

    res.json({
      botSettings,
      communitySettings,
      gallerySettings,
      ticketSettings,
      levelingSettings,
      rewardRoles,
      galleryTags,
      teamRoles: serializeSelectableRoles(teamRoles),
      publicRoles: serializeSelectableRoles(publicRoles),
      roleCategories: await serializeRoleCategories(guildId, roleCategories),
      onboarding,
      metadata,
      serverTimeZone: serverTimeZone(),
      readiness
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/settings/bot', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    await botSettingsService.ensureGuildSettings(guildId);
    const updates = buildBotUpdates(req.body);
    const settings = await botSettingsRepository.updateSettings(guildId, updates);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

app.post('/api/settings/bot/test-welcome', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const settings = await botSettingsService.ensureGuildSettings(guildId);
    const channelId = settings.welcome_channel_id || process.env.WELCOME_CHANNEL_ID;
    if (!channelId) {
      throw badRequest('Choose a welcome channel before sending a test welcome.');
    }

    const guildMetadata = await discordRequest(`/guilds/${guildId}?with_counts=true`);
    const botUser = await discordRequest('/users/@me');
    const fakeMember = {
      guild: {
        id: guildId,
        name: guildMetadata.name || 'the server',
        memberCount: guildMetadata.approximate_member_count || 0
      },
      user: {
        displayAvatarURL: () => botUser.avatar
          ? `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.png?size=256`
          : 'https://cdn.discordapp.com/embed/avatars/0.png'
      },
      toString: () => '@new member'
    };

    const payload = buildWelcomePayload(fakeMember, {
      guildName: guildMetadata.name || 'the server',
      memberCount: guildMetadata.approximate_member_count || 'many',
      mention: '@new member'
    });

    const message = await discordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: serializeMessagePayload(payload)
    });

    res.status(201).json({ messageId: message.id, channelId });
  } catch (error) {
    next(error);
  }
});

app.put('/api/settings/leveling', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    await guildSettingsRepository.ensureSettings(guildId);
    const updates = buildLevelingUpdates(req.body);
    const settings = await guildSettingsRepository.updateSettings(guildId, updates);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

app.put('/api/settings/community', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    await communitySettingsService.ensureGuildSettings(guildId);
    const updates = buildCommunityUpdates(req.body);
    const settings = await communitySettingsService.updateSettings(guildId, updates);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

app.put('/api/settings/gallery', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    await gallerySettingsService.ensureGuildSettings(guildId);
    const updates = buildGalleryUpdates(req.body);
    const settings = await gallerySettingsRepository.updateSettings(guildId, updates);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

app.post('/api/settings/gallery-tags', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const name = String(req.body.name || '').trim();
    if (!name) {
      throw badRequest('Provide a gallery tag name.');
    }

    const tag = await galleryTagService.addTag(
      guildId,
      name,
      galleryCategoriesFromInput(req.body.category || 'all')
    );
    const tags = await galleryTagService.listTags(guildId);
    res.status(201).json({ tag, tags });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/settings/gallery-tags/:tagName', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const tagName = String(req.params.tagName || '').trim();
    if (!tagName) {
      throw badRequest('Provide a gallery tag name.');
    }

    const tag = await galleryTagService.removeTag(guildId, tagName);
    if (!tag) {
      throw badRequest('That gallery tag was not active.');
    }

    const tags = await galleryTagService.listTags(guildId);
    res.json({ tag, tags });
  } catch (error) {
    next(error);
  }
});

app.put('/api/settings/tickets', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    await ticketSettingsService.ensureGuildSettings(guildId);
    const updates = buildTicketUpdates(req.body);
    const settings = await ticketSettingsService.updateSettings(guildId, updates);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

app.post('/api/settings/rewards', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const roleId = asNullableId(req.body.roleId);
    if (!roleId) {
      throw badRequest('Choose a reward role.');
    }

    const requiredLevel = parseRequiredLevel(req.body.requiredLevel);
    const reward = await rewardRoleService.addReward(guildId, roleId, requiredLevel, 'dashboard');
    const rewards = await rewardRoleService.listRewards(guildId);
    res.status(201).json({ reward, rewards });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/settings/rewards/:roleId', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const roleId = asNullableId(req.params.roleId);
    if (!roleId) {
      throw badRequest('Choose a reward role.');
    }

    const reward = await rewardRoleService.removeReward(
      guildId,
      roleId,
      'dashboard',
      'Removed from the dashboard.'
    );

    if (!reward) {
      throw badRequest('That reward role was not active.');
    }

    const rewards = await rewardRoleService.listRewards(guildId);
    res.json({ reward, rewards });
  } catch (error) {
    next(error);
  }
});

app.put('/api/settings/onboarding', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const skillRoles = req.body.skillRoles || {};
    const regionRoles = req.body.regionRoles || {};

    for (const option of onboardingRoleService.SKILL_OPTIONS) {
      const roleId = asNullableId(skillRoles[option.key]);
      if (!roleId) {
        throw badRequest(`Choose a role for skill level ${option.label}.`);
      }
      await onboardingRoleService.setSkillRole(guildId, option.key, roleId);
    }

    for (const option of onboardingRoleService.REGION_OPTIONS) {
      if (!Object.prototype.hasOwnProperty.call(regionRoles, option.key)) continue;
      const roleId = asNullableId(regionRoles[option.key]);
      if (roleId) {
        await onboardingRoleService.setRegionRole(guildId, option.key, roleId);
      } else {
        await onboardingRoleService.disableRegionRole(guildId, option.key);
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'coachRoleId')) {
      await communitySettingsService.updateSettings(guildId, {
        coach_role_id: asNullableId(req.body.coachRoleId)
      });
    }

    const [communitySettings, refreshedSkillRoles, refreshedRegionRoles] = await Promise.all([
      communitySettingsService.ensureGuildSettings(guildId),
      onboardingRoleService.listRolesByGroup(guildId, 'skill'),
      onboardingRoleService.listRolesByGroup(guildId, 'region')
    ]);

    res.json({
      communitySettings,
      onboarding: {
        skillRoles: roleMapFromRows(refreshedSkillRoles),
        regionRoles: roleMapFromRows(refreshedRegionRoles)
      }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/settings/team-roles', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const label = String(req.body.label || '').trim();
    const roleId = asNullableId(req.body.roleId);
    const sortOrder = Number.parseInt(req.body.sortOrder, 10);

    if (!label) {
      throw badRequest('Provide a team label.');
    }

    if (!roleId) {
      throw badRequest('Choose a Discord role for this team.');
    }

    const teamRole = await teamRoleService.upsertTeamRole(
      guildId,
      label,
      roleId,
      Number.isFinite(sortOrder) ? sortOrder : 0
    );
    const teamRoles = await teamRoleService.listTeamRoles(guildId);

    res.status(201).json({
      teamRole,
      teamRoles: serializeSelectableRoles(teamRoles)
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/settings/role-categories', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const category = await roleCategoryService.upsertCategory(guildId, {
      categoryKey: req.body.categoryKey,
      commandName: req.body.commandName,
      label: req.body.label,
      description: req.body.description,
      selectionMode: req.body.selectionMode,
      isEnabled: req.body.isEnabled !== false,
      sortOrder: Number.parseInt(req.body.sortOrder, 10) || 0
    });

    res.status(201).json({ category });
  } catch (error) {
    next(error);
  }
});

app.post('/api/settings/role-categories/:categoryKey/options', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const option = await roleCategoryService.upsertCategoryOption(guildId, req.params.categoryKey, {
      label: req.body.label,
      roleId: asNullableId(req.body.roleId),
      sortOrder: Number.parseInt(req.body.sortOrder, 10) || 0
    });

    res.status(201).json({ option });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/settings/role-categories/:categoryKey/options/:optionKey', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    await roleCategoryService.disableCategoryOption(guildId, req.params.categoryKey, req.params.optionKey);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/settings/team-roles/:optionKey', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const optionKey = String(req.params.optionKey || '').trim();
    if (!optionKey) {
      throw badRequest('Choose a team role option to remove.');
    }

    const teamRole = await teamRoleService.disableTeamRole(guildId, optionKey);
    if (!teamRole) {
      throw badRequest('That team role option was not active.');
    }

    const teamRoles = await teamRoleService.listTeamRoles(guildId);
    res.json({
      teamRole,
      teamRoles: serializeSelectableRoles(teamRoles)
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/settings/public-roles', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const label = String(req.body.label || '').trim();
    const roleId = asNullableId(req.body.roleId);
    const emoji = String(req.body.emoji || '').trim();
    const sortOrder = Number.parseInt(req.body.sortOrder, 10);

    if (!label) {
      throw badRequest('Provide a public role label.');
    }

    if (!roleId) {
      throw badRequest('Choose a Discord role.');
    }

    if (!emoji) {
      throw badRequest('Choose an emoji for this reaction role.');
    }

    const publicRole = await publicRoleService.upsertPublicRole(guildId, label, roleId, emoji, sortOrder);
    const publicRoles = await publicRoleService.listPublicRoles(guildId);

    res.status(201).json({
      publicRole,
      publicRoles: serializeSelectableRoles(publicRoles)
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/settings/public-roles/:optionKey', async (req, res, next) => {
  try {
    const guildId = resolveGuildId(req);
    const optionKey = String(req.params.optionKey || '').trim();
    if (!optionKey) {
      throw badRequest('Choose a public role option to remove.');
    }

    const publicRole = await publicRoleService.disablePublicRole(guildId, optionKey);
    const publicRoles = await publicRoleService.listPublicRoles(guildId);

    res.json({
      publicRole,
      publicRoles: serializeSelectableRoles(publicRoles)
    });
  } catch (error) {
    next(error);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((error, req, res, next) => {
  logger.error('Dashboard request failed', error);
  res.status(error.statusCode || 500).json({
    error: error.message || 'Dashboard request failed.'
  });
});

app.listen(port, host, () => {
  if (!dashboardPassword) {
    logger.warn('Dashboard password is not set. Direct access is limited to localhost.');
  }
  logger.info(`PanzerVault Bot dashboard running on http://${host}:${port}`);
});
