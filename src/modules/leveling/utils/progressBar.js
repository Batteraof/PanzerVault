function buildProgressBar(percentage, size = 14) {
  const clamped = Math.max(0, Math.min(100, Number(percentage) || 0));
  const filled = Math.round((clamped / 100) * size);
  const empty = Math.max(0, size - filled);

  return `[${'#'.repeat(filled)}${'-'.repeat(empty)}] ${Math.floor(clamped)}%`;
}

module.exports = {
  buildProgressBar
};
