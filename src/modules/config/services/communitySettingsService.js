const config = require('../../../config');
const communitySettingsRepository = require('../../../db/repositories/communitySettingsRepository');

function defaultsFromEnv() {
  return {
    onboardingEnabled: config.community.onboardingEnabled,
    communityChannelId: config.community.communityChannelId || null,
    videoEnabled: config.community.videoEnabled,
    videoChannelId: config.community.videoChannelId || null,
    spotlightEnabled: config.community.spotlightEnabled,
    spotlightChannelId: config.community.spotlightChannelId || null,
    spotlightRoleId: config.community.spotlightRoleId || null,
    eventEnabled: config.community.eventEnabled,
    eventChannelId: config.community.eventChannelId || null,
    anniversaryEnabled: config.community.anniversaryEnabled,
    weeklyRecapEnabled: config.community.weeklyRecapEnabled,
    softModerationEnabled: config.community.softModerationEnabled,
    moderationLogChannelId: config.community.moderationLogChannelId || null,
    coachRoleId: config.community.coachRoleId || null
  };
}

async function ensureGuildSettings(guildId, client) {
  return communitySettingsRepository.ensureSettings(guildId, defaultsFromEnv(), client);
}

async function updateSettings(guildId, updates) {
  await ensureGuildSettings(guildId);
  return communitySettingsRepository.updateSettings(guildId, updates);
}

module.exports = {
  ensureGuildSettings,
  updateSettings
};
