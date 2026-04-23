const {
  CATEGORIES,
  ALLOWED_IMAGE_CONTENT_TYPES,
  MAX_CAPTION_LENGTH,
  MAX_IMAGES,
  MIN_IMAGES
} = require('../constants/galleryConfig');
const { GalleryUserError } = require('../utils/galleryErrors');
const { isAllowedImageExtension } = require('../utils/fileUtils');
const { validateYoutubeUrl } = require('../utils/youtubeUtils');

const DISCORD_MENTION_PATTERN = /@everyone|@here|<@!?\d+>|<@&\d+>|<#\d+>/i;

function getAttachmentOptions(interaction) {
  const attachments = [];

  for (let index = 1; index <= MAX_IMAGES; index += 1) {
    const attachment = interaction.options.getAttachment(`image_${index}`, index === 1);
    if (!attachment) continue;

    attachments.push({
      url: attachment.url,
      filename: attachment.name,
      contentType: attachment.contentType || null,
      size: attachment.size || null,
      displayOrder: attachments.length + 1
    });
  }

  return attachments;
}

function validateCategory(category) {
  if (!Object.values(CATEGORIES).includes(category)) {
    throw new GalleryUserError('Choose a valid gallery category.');
  }
}

function validateAttachments(attachments) {
  if (attachments.length < MIN_IMAGES) {
    throw new GalleryUserError('Add at least one PNG or JPG image.');
  }

  if (attachments.length > MAX_IMAGES) {
    throw new GalleryUserError(`Gallery submissions can include at most ${MAX_IMAGES} images.`);
  }

  for (const attachment of attachments) {
    if (!attachment.url || !attachment.filename) {
      throw new GalleryUserError('One of the uploaded images could not be read.');
    }

    if (!isAllowedImageExtension(attachment.filename)) {
      throw new GalleryUserError('Only .png, .jpg, and .jpeg image uploads are allowed.');
    }

    if (
      attachment.contentType &&
      !ALLOWED_IMAGE_CONTENT_TYPES.includes(attachment.contentType.toLowerCase())
    ) {
      throw new GalleryUserError('Only PNG and JPG image uploads are allowed.');
    }
  }
}

function validateCaption(captionInput) {
  if (!captionInput || !captionInput.trim()) return null;

  const caption = captionInput.trim();

  if (caption.length > MAX_CAPTION_LENGTH) {
    throw new GalleryUserError(`Captions must be ${MAX_CAPTION_LENGTH} characters or shorter.`);
  }

  if (DISCORD_MENTION_PATTERN.test(caption)) {
    throw new GalleryUserError('Captions cannot include Discord mentions.');
  }

  return caption;
}

function validateVideoLink(videoLinkInput) {
  if (!videoLinkInput || !videoLinkInput.trim()) return null;

  const videoLink = validateYoutubeUrl(videoLinkInput);
  if (!videoLink) {
    throw new GalleryUserError('Video links must be valid YouTube URLs.');
  }

  return videoLink;
}

function buildSubmitInput(rawInput) {
  const category = rawInput.category;
  const attachments = Array.isArray(rawInput.assets) ? rawInput.assets : [];
  const caption = rawInput.caption || rawInput.description || '';
  const videoLink = rawInput.videoLink || '';
  const tagsInput = rawInput.tagsInput || '';

  validateCategory(category);
  validateAttachments(attachments);

  return {
    category,
    assets: attachments,
    caption: validateCaption(caption),
    videoLink: validateVideoLink(videoLink),
    tagsInput
  };
}

function getSubmitInput(interaction) {
  return buildSubmitInput({
    category: interaction.options.getString('category', true),
    assets: getAttachmentOptions(interaction),
    caption: interaction.options.getString('description') || interaction.options.getString('caption') || '',
    videoLink: interaction.options.getString('video_link') || '',
    tagsInput: interaction.options.getString('tags') || ''
  });
}

module.exports = {
  buildSubmitInput,
  getAttachmentOptions,
  getSubmitInput,
  validateAttachments,
  validateCaption,
  validateCategory,
  validateVideoLink,
  DISCORD_MENTION_PATTERN
};
