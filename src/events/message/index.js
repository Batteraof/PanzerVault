const xpService = require('../../modules/leveling/services/xpService');
const logger = require('../../logger');

async function handleMessageCreate(message) {
  if (message.content === '!ping') {
    await message.reply('Pong! 🏓');
    return;
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
