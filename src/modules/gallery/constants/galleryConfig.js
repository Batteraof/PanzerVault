const config = require('../../../config');

const CATEGORIES = {
  SHOWCASE: 'showcase',
  MEME: 'meme'
};

const CATEGORY_LABELS = {
  [CATEGORIES.SHOWCASE]: 'Showcase',
  [CATEGORIES.MEME]: 'Meme'
};

const INITIAL_APPROVED_TAGS = [
  'US Tanks',
  'GER Tanks',
  'USSR Tanks'
];

module.exports = {
  CATEGORIES,
  CATEGORY_LABELS,
  INITIAL_APPROVED_TAGS,
  ALLOWED_IMAGE_EXTENSIONS: ['.png', '.jpg', '.jpeg'],
  ALLOWED_IMAGE_CONTENT_TYPES: ['image/png', 'image/jpeg', 'image/jpg'],
  MAX_IMAGES: 5,
  MIN_IMAGES: 1,
  MAX_CAPTION_LENGTH: 300,
  YOUTUBE_HOSTNAMES: [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
    'www.youtu.be'
  ],
  COOLDOWN_MS: config.gallery.submissionCooldownHours * 60 * 60 * 1000,
  MAX_SUBMISSIONS_PER_24H: config.gallery.maxSubmissionsPer24h
};
