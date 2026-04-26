const mediaIntakeService = require('./mediaIntakeService');
const logger = require('../../../logger');

async function handleDeletedMessage(message) {
  try {
    await mediaIntakeService.removeForDeletedSourceMessage(message);
  } catch (error) {
    logger.warn('media messageDelete handler failed', error);
  }
}

module.exports = {
  handleDeletedMessage
};