const messageActivityRepository = require('../../../db/repositories/messageActivityRepository');
const communitySettingsService = require('../../config/services/communitySettingsService');
const eventService = require('./eventService');
const spotlightService = require('./spotlightService');
const anniversaryService = require('./anniversaryService');
const recapService = require('./recapService');
const logger = require('../../../logger');

const INTERVAL_MS = 30 * 60 * 1000;

let timer = null;
let running = false;

async function runOnce(client) {
  if (running) return;
  running = true;

  try {
    await eventService.processDueReminders(client);

    for (const guild of client.guilds.cache.values()) {
      await communitySettingsService.ensureGuildSettings(guild.id);
      await spotlightService.syncCycle(client, guild.id);
      await anniversaryService.maybePostAnniversaries(client, guild);
      await recapService.maybePostWeeklyRecap(client, guild);
    }

    await messageActivityRepository.deleteOlderThan(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000));
  } catch (error) {
    logger.warn('Community scheduler run failed', error);
  } finally {
    running = false;
  }
}

function start(client) {
  if (timer) return;

  runOnce(client).catch(error => {
    logger.warn('Initial community scheduler run failed', error);
  });

  timer = setInterval(() => {
    runOnce(client).catch(error => {
      logger.warn('Community scheduler interval failed', error);
    });
  }, INTERVAL_MS);
}

function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  start,
  stop,
  runOnce
};
