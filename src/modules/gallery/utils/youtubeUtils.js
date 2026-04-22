const { YOUTUBE_HOSTNAMES } = require('../constants/galleryConfig');

function validateYoutubeUrl(input) {
  if (!input || !input.trim()) return null;

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(url.protocol)) return null;

  const hostname = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTNAMES.includes(hostname)) return null;

  url.hash = '';
  return url.toString();
}

module.exports = {
  validateYoutubeUrl
};
