const config = require('../../../config');
const gallerySettingsRepository = require('../../../db/repositories/gallerySettingsRepository');
const { CATEGORIES } = require('../constants/galleryConfig');

function defaultsFromEnv() {
  return {
    showcaseChannelId: config.gallery.showcaseChannelId || null,
    memeChannelId: config.gallery.memeChannelId || null,
    logChannelId: config.gallery.logChannelId || null
  };
}

async function ensureGuildSettings(guildId, client) {
  return gallerySettingsRepository.ensureSettings(guildId, defaultsFromEnv(), client);
}

function getTargetChannelId(settings, category) {
  if (category === CATEGORIES.SHOWCASE) return settings.showcase_channel_id;
  if (category === CATEGORIES.MEME) return settings.meme_channel_id;
  return null;
}

module.exports = {
  ensureGuildSettings,
  getTargetChannelId
};
