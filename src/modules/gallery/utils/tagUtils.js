function normalizeTagName(tagName) {
  return String(tagName || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseTagInput(input) {
  if (!input || !input.trim()) return [];

  const seen = new Set();
  const parsed = [];

  for (const rawTag of input.split(',')) {
    const tagName = rawTag.trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeTagName(tagName);

    if (!tagName || !normalizedName || seen.has(normalizedName)) continue;

    seen.add(normalizedName);
    parsed.push({ tagName, normalizedName });
  }

  return parsed;
}

module.exports = {
  normalizeTagName,
  parseTagInput
};
