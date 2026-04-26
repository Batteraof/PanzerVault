const xpService = require('../../modules/leveling/services/xpService');
const softModerationService = require('../../modules/community/services/softModerationService');
const mediaIntakeService = require('../../modules/media/services/mediaIntakeService');
const logger = require('../../logger');

async function handleMessageCreate(message) {
  if (message.content === '!ping') {
    await message.reply('Pong!');
    return;
  }

  let blocked = false;

  try {
    const moderation = await softModerationService.processMessage(message);
    blocked = Boolean(moderation?.blocked);
  } catch (error) {
    logger.warn('Failed to process soft moderation', error);
  }

  if (blocked) {
    return;
  }

  try {
    await mediaIntakeService.processMessage(message);
  } catch (error) {
    logger.warn('Failed to process media intake', error);
  }

  try {
    await xpService.awardTextXpFromMessage(message);
  } catch (error) {
    logger.warn('Failed to process text XP', error);
  }
}

module.exports = {
  handleMessageCreate
};