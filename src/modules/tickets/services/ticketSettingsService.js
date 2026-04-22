const ticketSettingsRepository = require('../../../db/repositories/ticketSettingsRepository');

async function ensureGuildSettings(guildId, client) {
  return ticketSettingsRepository.ensureSettings(guildId, client);
}

async function updateSettings(guildId, updates) {
  await ensureGuildSettings(guildId);
  return ticketSettingsRepository.updateSettings(guildId, updates);
}

module.exports = {
  ensureGuildSettings,
  updateSettings
};
