const config = require('../../../config');

module.exports = {
  MAX_LEVEL: config.leveling.maxLevel,
  TEXT_COOLDOWN_SECONDS: config.leveling.textCooldownSeconds,
  VOICE_XP_SECONDS_PER_POINT: config.leveling.voiceXpSecondsPerPoint,
  VOICE_TRACKING_INTERVAL_MS: config.leveling.voiceTrackingIntervalMs,
  AFK_VOICE_CHANNEL_IDS: config.leveling.afkVoiceChannelIds,
  STREAK_WINDOW_MS: 24 * 60 * 60 * 1000
};
