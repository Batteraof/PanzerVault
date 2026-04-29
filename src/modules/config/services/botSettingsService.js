const config = require('../../../config');
const botSettingsRepository = require('../../../db/repositories/botSettingsRepository');

function defaultsFromEnv() {
  return {
    welcomeChannelId: config.channels.welcome || null,
    rolePanelChannelId: config.channels.rolePanel || null
  };
}

async function ensureGuildSettings(guildId, client) {
  return botSettingsRepository.ensureSettings(guildId, defaultsFromEnv(), client);
}

async function updateWelcomeChannel(guildId, channelId) {
  await ensureGuildSettings(guildId);
  return botSettingsRepository.updateSettings(guildId, {
    welcome_channel_id: channelId
  });
}

async function updateWelcomeEnabled(guildId, enabled) {
  await ensureGuildSettings(guildId);
  return botSettingsRepository.updateSettings(guildId, {
    welcome_enabled: enabled
  });
}

async function updateRolePanelChannel(guildId, channelId) {
  await ensureGuildSettings(guildId);
  return botSettingsRepository.updateSettings(guildId, {
    role_panel_channel_id: channelId
  });
}

module.exports = {
  ensureGuildSettings,
  updateWelcomeChannel,
  updateWelcomeEnabled,
  updateRolePanelChannel
};
