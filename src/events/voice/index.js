const voiceTrackingService = require('../../modules/leveling/services/voiceTrackingService');
const logger = require('../../logger');

async function handleVoiceStateUpdate(oldState, newState) {
  try {
    await voiceTrackingService.handleVoiceStateUpdate(oldState, newState, newState.client);
  } catch (error) {
    logger.warn('Failed to handle voice state update', error);
  }
}

module.exports = {
  handleVoiceStateUpdate
};
