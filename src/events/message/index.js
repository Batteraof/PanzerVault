const xpService = require('../../modules/leveling/services/xpService');
const softModerationService = require('../../modules/community/services/softModerationService');
const submitEntryFlow = require('../../modules/interactions/flows/submitEntryFlow');
const logger = require('../../logger');

async function handleMessageCreate(message) {
  if (message.content === '!ping') {
    await message.reply('Pong!');
    return;
  }

  try {
    const capturedSubmissionAssets = await submitEntryFlow.captureMessageAttachments(message);
    if (capturedSubmissionAssets) return;
  } catch (error) {
    logger.warn('Failed to capture submit draft attachments', error);
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
    await xpService.awardTextXpFromMessage(message);
  } catch (error) {
    logger.warn('Failed to process text XP', error);
  }
}

module.exports = {
  handleMessageCreate
};
