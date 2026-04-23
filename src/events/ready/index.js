const { setupRolePanel } = require('../../lib/rolePanel');
const guildSettingsRepository = require('../../db/repositories/guildSettingsRepository');
const voiceTrackingService = require('../../modules/leveling/services/voiceTrackingService');
const galleryService = require('../../modules/gallery/services/galleryService');
const botSettingsService = require('../../modules/config/services/botSettingsService');
const communitySettingsService = require('../../modules/config/services/communitySettingsService');
const onboardingRoleService = require('../../modules/config/services/onboardingRoleService');
const serverPanelService = require('../../modules/config/services/serverPanelService');
const ticketSettingsService = require('../../modules/tickets/services/ticketSettingsService');
const communitySchedulerService = require('../../modules/community/services/communitySchedulerService');
const logger = require('../../logger');

async function handleReady(client) {
  logger.info(`Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await botSettingsService.ensureGuildSettings(guild.id);
    await communitySettingsService.ensureGuildSettings(guild.id);
    await guildSettingsRepository.ensureSettings(guild.id);
    await galleryService.ensureGuildGallerySetup(guild.id);
    await ticketSettingsService.ensureGuildSettings(guild.id);
    await onboardingRoleService.ensureDefaults(guild.id);
    await serverPanelService.refreshGuildPanels(client, guild.id);
  }

  await setupRolePanel(client);
  await voiceTrackingService.recoverOpenSessions(client);
  await voiceTrackingService.processActiveSessions(client);
  voiceTrackingService.start(client);
  communitySchedulerService.start(client);

  logger.info('Bot is ready');
}

module.exports = {
  handleReady
};
