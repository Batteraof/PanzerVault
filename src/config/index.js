require('dotenv').config();

const DEFAULT_ROLE_MAP = {
  role_beginner: '1496208141753253888',
  role_medium: '1496208188775727286',
  role_expert: '1496208236502585588'
};

const DEFAULT_REGION_ROLE_LABELS = {
  eu: 'EU',
  uk: 'UK',
  na: 'NA',
  latam: 'LATAM',
  africa: 'AFRICA',
  sa: 'SA',
  ea: 'EA',
  sea: 'SEA',
  oce: 'OCE'
};

function boolFromEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function intFromEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function csvFromEnv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function roleMapFromEnv() {
  if (!process.env.ROLE_MAP_JSON) return DEFAULT_ROLE_MAP;

  try {
    const parsed = JSON.parse(process.env.ROLE_MAP_JSON);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('ROLE_MAP_JSON must be an object');
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (!key.startsWith('role_') || typeof value !== 'string' || value.length === 0) {
        throw new Error('ROLE_MAP_JSON entries must look like "role_name": "role_id"');
      }
    }

    return parsed;
  } catch (error) {
    throw new Error(`Invalid ROLE_MAP_JSON: ${error.message}`);
  }
}

function simpleStringMapFromEnv(envKey) {
  if (!process.env[envKey]) return {};

  try {
    const parsed = JSON.parse(process.env[envKey]);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${envKey} must be an object`);
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new Error(`${envKey} must only contain string keys and values`);
      }
    }

    return parsed;
  } catch (error) {
    throw new Error(`Invalid ${envKey}: ${error.message}`);
  }
}

const hostingProfile = (process.env.HOSTING_PROFILE || 'laptop').toLowerCase();
const laptopProfile = hostingProfile === 'laptop';

const config = {
  runtime: {
    hostingProfile
  },
  discord: {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID || '',
    guildId: process.env.GUILD_ID || '1495760274827903086'
  },
  database: {
    connectionString: process.env.DATABASE_URL,
    ssl: boolFromEnv(process.env.DB_SSL, false),
    poolMax: intFromEnv(process.env.DB_POOL_MAX, laptopProfile ? 3 : 10),
    idleTimeoutMillis: intFromEnv(process.env.DB_IDLE_TIMEOUT_MS, laptopProfile ? 10_000 : 30_000),
    connectionTimeoutMillis: intFromEnv(process.env.DB_CONNECTION_TIMEOUT_MS, 10_000)
  },
  channels: {
    rolePanel: process.env.ROLE_PANEL_CHANNEL_ID || '1495760275448528928',
    welcome: process.env.WELCOME_CHANNEL_ID || process.env.ROLE_PANEL_CHANNEL_ID || '1495760275448528928',
    rules: process.env.RULES_CHANNEL_ID || '',
    siteUrl: process.env.SITE_URL || 'https://tanksletloose.carrd.co/',
    generalUrl:
      process.env.GENERAL_CHANNEL_URL ||
      'https://discord.com/channels/1495760274827903086/1495924550662098944',
    gameChannelId: process.env.GAME_CHANNEL_ID || '1447381195003400340',
    readyRoleId: process.env.READY_ROLE_ID || '1496201325317197895',
    verifiedRoleId: process.env.RULES_VERIFIED_ROLE_ID || ''
  },
  botInfo: {
    ownerName: process.env.BOT_OWNER_NAME || '',
    contactText: process.env.BOT_CONTACT_TEXT || '',
    supportChannelId: process.env.BOT_SUPPORT_CHANNEL_ID || ''
  },
  dashboard: {
    url: process.env.DASHBOARD_URL || ''
  },
  community: {
    onboardingEnabled: boolFromEnv(process.env.ONBOARDING_ENABLED, false),
    communityChannelId: process.env.COMMUNITY_CHANNEL_ID || '',
    mediaChannelId: process.env.MEDIA_CHANNEL_ID || '',
    videoEnabled: boolFromEnv(process.env.VIDEO_ENABLED, true),
    videoChannelId: process.env.VIDEO_CHANNEL_ID || '',
    spotlightEnabled: boolFromEnv(process.env.SPOTLIGHT_ENABLED, true),
    spotlightChannelId: process.env.SPOTLIGHT_CHANNEL_ID || '',
    spotlightRoleId: process.env.SPOTLIGHT_ROLE_ID || '',
    eventEnabled: boolFromEnv(process.env.EVENT_ENABLED, true),
    eventChannelId: process.env.EVENT_CHANNEL_ID || '',
    anniversaryEnabled: boolFromEnv(process.env.ANNIVERSARY_ENABLED, true),
    weeklyRecapEnabled: boolFromEnv(process.env.WEEKLY_RECAP_ENABLED, true),
    softModerationEnabled: boolFromEnv(process.env.SOFT_MODERATION_ENABLED, true),
    moderationLogChannelId: process.env.MODERATION_LOG_CHANNEL_ID || '',
    coachRoleId: process.env.COACH_ROLE_ID || ''
  },
  gallery: {
    showcaseChannelId: process.env.GALLERY_SHOWCASE_CHANNEL_ID || '',
    memeChannelId: process.env.GALLERY_MEME_CHANNEL_ID || '',
    logChannelId: process.env.GALLERY_LOG_CHANNEL_ID || '',
    submissionCooldownHours: intFromEnv(process.env.GALLERY_SUBMISSION_COOLDOWN_HOURS, 6),
    maxSubmissionsPer24h: intFromEnv(process.env.GALLERY_MAX_SUBMISSIONS_PER_24H, 3)
  },
  rolePanelMessageId: process.env.ROLE_PANEL_MESSAGE_ID || null,
  roleMap: roleMapFromEnv(),
  regionRoleMap: simpleStringMapFromEnv('REGION_ROLE_MAP_JSON'),
  regionRoleLabels: DEFAULT_REGION_ROLE_LABELS,
  leveling: {
    maxLevel: Math.min(intFromEnv(process.env.MAX_LEVEL, 500), 500),
    textCooldownSeconds: intFromEnv(process.env.TEXT_XP_COOLDOWN_SECONDS, 15),
    voiceXpSecondsPerPoint: intFromEnv(process.env.VOICE_XP_SECONDS_PER_POINT, 120),
    voiceTrackingIntervalMs: intFromEnv(process.env.VOICE_TRACKING_INTERVAL_MS, laptopProfile ? 120_000 : 60_000),
    afkVoiceChannelIds: csvFromEnv(process.env.AFK_VOICE_CHANNEL_IDS),
    infoChannelId: process.env.LEVELING_INFO_CHANNEL_ID || ''
  },
  onboarding: {
    rulesEnabled: boolFromEnv(process.env.RULES_ENABLED, false)
  }
};

function validateConfig() {
  const missing = [];
  if (!config.discord.token) missing.push('TOKEN');
  if (!config.database.connectionString) missing.push('DATABASE_URL');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
}

module.exports = {
  ...config,
  validateConfig
};
