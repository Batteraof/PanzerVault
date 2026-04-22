const path = require('node:path');
const { ALLOWED_IMAGE_EXTENSIONS } = require('../constants/galleryConfig');

function getLowerExtension(filename) {
  return path.extname(String(filename || '')).toLowerCase();
}

function isAllowedImageExtension(filename) {
  return ALLOWED_IMAGE_EXTENSIONS.includes(getLowerExtension(filename));
}

function publicGalleryFilename(submissionId, asset) {
  const extension = getLowerExtension(asset.filename) || '.jpg';
  return `gallery-${submissionId}-${asset.display_order}${extension}`;
}

module.exports = {
  getLowerExtension,
  isAllowedImageExtension,
  publicGalleryFilename
};
