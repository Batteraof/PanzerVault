const { setupRolePanel } = require('../../lib/rolePanel');
const guildSettingsRepository = require('../../db/repositories/guildSettingsRepository');
const voiceTrackingService = require('../../modules/leveling/services/voiceTrackingService');
const galleryService = require('../../modules/gallery/services/galleryService');
const botSettingsService = require('../../modules/config/services/botSettingsService');
const ticketSettingsService = require('../../modules/tickets/services/ticketSettingsService');
const logger = require('../../logger');

async function handleReady(client) {
  logger.info(`Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await botSettingsService.ensureGuildSettings(guild.id);
    await guildSettingsRepository.ensureSettings(guild.id);
    await galleryService.ensureGuildGallerySetup(guild.id);
    await ticketSettingsService.ensureGuildSettings(guild.id);
  }

  await setupRolePanel(client);
  await voiceTrackingService.recoverOpenSessions(client);
  await voiceTrackingService.processActiveSessions(client);
  voiceTrackingService.start(client);

  logger.info('Bot is ready');
}

module.exports = {
  handleReady
};
