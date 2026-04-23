const galleryMessageDeleteService = require('../../modules/gallery/services/galleryMessageDeleteService');
const videoMessageDeleteService = require('../../modules/community/services/videoMessageDeleteService');
const logger = require('../../logger');

async function handleMessageDelete(message) {
  try {
    await galleryMessageDeleteService.handleDeletedMessage(message);
  } catch (error) {
    logger.warn('gallery messageDelete handler failed', error);
  }

  try {
    await videoMessageDeleteService.handleDeletedMessage(message);
  } catch (error) {
    logger.warn('video messageDelete handler failed', error);
  }
}

module.exports = {
  handleMessageDelete
};
