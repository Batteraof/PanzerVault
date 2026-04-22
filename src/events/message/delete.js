const galleryMessageDeleteService = require('../../modules/gallery/services/galleryMessageDeleteService');
const logger = require('../../logger');

async function handleMessageDelete(message) {
  try {
    await galleryMessageDeleteService.handleDeletedMessage(message);
  } catch (error) {
    logger.warn('messageDelete handler failed', error);
  }
}

module.exports = {
  handleMessageDelete
};
