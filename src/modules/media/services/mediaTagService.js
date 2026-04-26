const mediaTagRepository = require('../../../db/repositories/mediaTagRepository');
const { normalizeTagName, parseTagInput } = require('../../gallery/utils/tagUtils');

const MAX_TAGS = 6;
const MAX_TAG_LENGTH = 40;
const MAX_EXISTING_OPTIONS = 25;

function assertTagInputSafe(input) {
  if (String(input || '').includes('@')) {
    throw new Error('Tags cannot contain @mentions.');
  }
}

function parseUserTags(input) {
  assertTagInputSafe(input);
  const parsed = parseTagInput(input);

  if (!parsed.length) {
    throw new Error('Add at least one tag so the post is easier to browse later.');
  }

  if (parsed.length > MAX_TAGS) {
    throw new Error(`Use up to ${MAX_TAGS} tags per post.`);
  }

  for (const tag of parsed) {
    if (tag.tagName.length > MAX_TAG_LENGTH) {
      throw new Error(`Tags must stay under ${MAX_TAG_LENGTH} characters.`);
    }
  }

  return parsed;
}

function levenshtein(left, right) {
  const a = String(left || '');
  const b = String(right || '');

  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function tokenOverlapScore(left, right) {
  const leftTokens = String(left || '').split('-').filter(Boolean);
  const rightTokens = String(right || '').split('-').filter(Boolean);

  if (!leftTokens.length || !rightTokens.length) return 0;

  const shared = leftTokens.filter(token => rightTokens.includes(token)).length;
  return shared / Math.max(leftTokens.length, rightTokens.length);
}

function similarityScore(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const distance = levenshtein(left, right);
  const maxLength = Math.max(left.length, right.length);
  const distanceScore = maxLength ? 1 - (distance / maxLength) : 0;
  const overlapScore = tokenOverlapScore(left, right);
  const containsScore = left.includes(right) || right.includes(left) ? 0.9 : 0;

  return Math.max(distanceScore, overlapScore * 0.88, containsScore);
}

function findBestSuggestion(candidate, knownTags) {
  let best = null;

  for (const knownTag of knownTags) {
    const score = similarityScore(candidate.normalizedName, knownTag.normalized_name);
    const distance = levenshtein(candidate.normalizedName, knownTag.normalized_name);
    const passes = score >= 0.74 || distance <= 2;

    if (!passes) continue;
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = {
        knownTag,
        score,
        distance
      };
    }
  }

  return best;
}

function buildTagOptions(knownTags) {
  return knownTags.slice(0, MAX_EXISTING_OPTIONS).map(tag => ({
    label: tag.tag_name,
    value: tag.normalized_name,
    description: tag.usage_count > 0 ? `Used ${tag.usage_count} time${tag.usage_count === 1 ? '' : 's'}` : 'Existing tag'
  }));
}

async function prepareTagDraft(guildId, rawInput, client) {
  const typedTags = parseUserTags(rawInput);
  const knownTags = await mediaTagRepository.listAllTags(guildId, client);
  const knownTagMap = new Map(knownTags.map(tag => [tag.normalized_name, tag]));

  const exactTags = [];
  const newTags = [];
  const suggestions = [];

  for (const candidate of typedTags) {
    const exact = knownTagMap.get(candidate.normalizedName);
    if (exact) {
      exactTags.push(exact);
      continue;
    }

    const suggestion = findBestSuggestion(candidate, knownTags);
    if (suggestion) {
      suggestions.push({
        typedName: candidate.tagName,
        typedNormalized: candidate.normalizedName,
        suggestedTag: suggestion.knownTag,
        score: Number(suggestion.score.toFixed(2))
      });
      continue;
    }

    newTags.push(candidate);
  }

  return {
    rawInput,
    typedTags,
    exactTags,
    newTags,
    suggestions,
    knownTags,
    knownTagOptions: buildTagOptions(knownTags)
  };
}

function dedupeResolvedTags(tags) {
  const byNormalized = new Map();

  for (const tag of tags) {
    const normalizedName = normalizeTagName(tag.normalizedName || tag.tagName);
    if (!normalizedName || byNormalized.has(normalizedName)) continue;

    byNormalized.set(normalizedName, {
      tagName: tag.tagName,
      normalizedName,
      existingTag: tag.existingTag || null
    });
  }

  return [...byNormalized.values()];
}

function resolveDraftTags(draft) {
  const knownTagMap = new Map((draft.knownTags || []).map(tag => [tag.normalized_name, tag]));
  const resolved = [];

  for (const exactTag of draft.exactTags || []) {
    resolved.push({
      tagName: exactTag.tag_name,
      normalizedName: exactTag.normalized_name,
      existingTag: exactTag
    });
  }

  for (const normalizedName of draft.selectedExistingNormalized || []) {
    const knownTag = knownTagMap.get(normalizedName);
    if (!knownTag) continue;

    resolved.push({
      tagName: knownTag.tag_name,
      normalizedName: knownTag.normalized_name,
      existingTag: knownTag
    });
  }

  for (const suggestion of draft.suggestions || []) {
    if (draft.useSuggestedTags) {
      resolved.push({
        tagName: suggestion.suggestedTag.tag_name,
        normalizedName: suggestion.suggestedTag.normalized_name,
        existingTag: suggestion.suggestedTag
      });
      continue;
    }

    resolved.push({
      tagName: suggestion.typedName,
      normalizedName: suggestion.typedNormalized,
      existingTag: null
    });
  }

  for (const newTag of draft.newTags || []) {
    resolved.push({
      tagName: newTag.tagName,
      normalizedName: newTag.normalizedName,
      existingTag: null
    });
  }

  return dedupeResolvedTags(resolved);
}

async function persistResolvedTags(guildId, userId, resolvedTags, client) {
  const persisted = [];

  for (const tag of dedupeResolvedTags(resolvedTags)) {
    if (tag.existingTag) {
      persisted.push(tag.existingTag);
      continue;
    }

    const saved = await mediaTagRepository.upsertTag(
      guildId,
      tag.tagName,
      tag.normalizedName,
      userId,
      client
    );

    if (saved) persisted.push(saved);
  }

  return persisted;
}

function formatTagList(tags) {
  if (!tags || !tags.length) return 'None selected yet.';
  return tags.map(tag => `\`${tag.tagName || tag.tag_name}\``).join(' ');
}

module.exports = {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  prepareTagDraft,
  resolveDraftTags,
  persistResolvedTags,
  formatTagList
};