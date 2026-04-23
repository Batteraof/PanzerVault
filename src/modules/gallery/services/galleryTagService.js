const galleryTagRepository = require('../../../db/repositories/galleryTagRepository');
const { CATEGORIES, INITIAL_APPROVED_TAGS } = require('../constants/galleryConfig');
const { GalleryUserError } = require('../utils/galleryErrors');
const { normalizeTagName, parseTagInput } = require('../utils/tagUtils');

async function ensureDefaultTags(guildId, client) {
  const tags = [];

  for (const tagName of INITIAL_APPROVED_TAGS) {
    const normalizedName = normalizeTagName(tagName);
    const tag = await galleryTagRepository.insertTagIfMissing(
      guildId,
      tagName,
      normalizedName,
      null,
      client
    );
    tags.push(tag);
  }

  return tags;
}

async function validateTags(guildId, category, tagInput, client) {
  await ensureDefaultTags(guildId, client);

  const requested = parseTagInput(tagInput);
  if (requested.length === 0) return [];

  const normalizedNames = requested.map(tag => tag.normalizedName);
  const activeTags = await galleryTagRepository.findActiveTagsByNormalizedNames(
    guildId,
    normalizedNames,
    category,
    client
  );
  const byNormalized = new Map(activeTags.map(tag => [tag.normalized_name, tag]));
  const invalid = requested.filter(tag => !byNormalized.has(tag.normalizedName));

  if (invalid.length > 0) {
    throw new GalleryUserError(
      `Invalid gallery tag(s): ${invalid.map(tag => tag.tagName).join(', ')}. Use /tags to see approved tags.`
    );
  }

  return normalizedNames.map(normalizedName => byNormalized.get(normalizedName));
}

async function listTags(guildId, category = null) {
  await ensureDefaultTags(guildId);
  return galleryTagRepository.listActiveTags(guildId, category);
}

function validateAllowedCategories(allowedCategories) {
  if (allowedCategories === null || allowedCategories === undefined) return null;
  if (!Array.isArray(allowedCategories)) {
    throw new GalleryUserError('Tag category config must be a list.');
  }

  const validCategories = new Set(Object.values(CATEGORIES));
  const cleaned = [];

  for (const category of allowedCategories) {
    if (!validCategories.has(category)) {
      throw new GalleryUserError(`Invalid gallery category for tag: ${category}`);
    }
    if (!cleaned.includes(category)) cleaned.push(category);
  }

  return cleaned.length > 0 ? cleaned : null;
}

async function addTag(guildId, tagName, allowedCategories = null) {
  const parsed = parseTagInput(tagName);

  if (parsed.length !== 1) {
    throw new GalleryUserError('Add exactly one tag name.');
  }

  const [tag] = parsed;
  return galleryTagRepository.upsertTag(
    guildId,
    tag.tagName,
    tag.normalizedName,
    validateAllowedCategories(allowedCategories)
  );
}

async function removeTag(guildId, tagName) {
  const normalizedName = normalizeTagName(tagName);
  if (!normalizedName) {
    throw new GalleryUserError('Provide a valid tag name.');
  }

  return galleryTagRepository.deactivateTag(guildId, normalizedName);
}

module.exports = {
  ensureDefaultTags,
  validateTags,
  listTags,
  addTag,
  removeTag
};
