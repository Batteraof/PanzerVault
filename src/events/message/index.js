const xpService = require('../../modules/leveling/services/xpService');
const softModerationService = require('../../modules/community/services/softModerationService');
const logger = require('../../logger');

async function handleMessageCreate(message) {
  if (message.content === '!ping') {
    await message.reply('Pong!');
    return;
  }

  try {
    const moderation = await softModerationService.processMessage(message);
    if (moderation.blocked) {
      return;
    }

    await xpService.awardTextXpFromMessage(message);
  } catch (error) {
    logger.warn('Failed to process text XP', error);
  }
}

module.exports = {
  handleMessageCreate
};
