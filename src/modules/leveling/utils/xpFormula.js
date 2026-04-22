const { MAX_LEVEL } = require('../constants/levelingConfig');

const totalXpCache = new Map([[0, 0]]);

function clampLevel(level) {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)));
}

function normalizeXp(totalXp) {
  if (!Number.isFinite(Number(totalXp))) return 0;
  return Math.max(0, Math.floor(Number(totalXp)));
}

function xpForNextLevel(level) {
  const clamped = clampLevel(level);
  if (clamped >= MAX_LEVEL) return 0;
  return 100 + 35 * clamped * clamped;
}

function totalXpRequiredForLevel(level) {
  const clamped = clampLevel(level);
  if (totalXpCache.has(clamped)) return totalXpCache.get(clamped);

  let highestKnownLevel = 0;
  for (const cachedLevel of totalXpCache.keys()) {
    if (cachedLevel > highestKnownLevel && cachedLevel < clamped) {
      highestKnownLevel = cachedLevel;
    }
  }

  let total = totalXpCache.get(highestKnownLevel);
  for (let currentLevel = highestKnownLevel; currentLevel < clamped; currentLevel += 1) {
    total += xpForNextLevel(currentLevel);
    totalXpCache.set(currentLevel + 1, total);
  }

  return total;
}

function maxTotalXp() {
  return totalXpRequiredForLevel(MAX_LEVEL);
}

function clampTotalXp(totalXp) {
  return Math.min(normalizeXp(totalXp), maxTotalXp());
}

function levelFromTotalXp(totalXp) {
  const clampedXp = clampTotalXp(totalXp);

  for (let level = 0; level < MAX_LEVEL; level += 1) {
    const nextLevelTotal = totalXpRequiredForLevel(level + 1);
    if (clampedXp < nextLevelTotal) return level;
  }

  return MAX_LEVEL;
}

function progressWithinLevel(totalXp) {
  const clampedXp = clampTotalXp(totalXp);
  const level = levelFromTotalXp(clampedXp);

  if (level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL,
      currentLevelXp: 0,
      xpNeededForNextLevel: 0,
      progressPercentage: 100,
      totalXpAtLevelStart: maxTotalXp(),
      totalXpForNextLevel: maxTotalXp()
    };
  }

  const totalXpAtLevelStart = totalXpRequiredForLevel(level);
  const needed = xpForNextLevel(level);
  const currentLevelXp = clampedXp - totalXpAtLevelStart;

  return {
    level,
    currentLevelXp,
    xpNeededForNextLevel: needed,
    progressPercentage: needed === 0 ? 100 : Math.floor((currentLevelXp / needed) * 100),
    totalXpAtLevelStart,
    totalXpForNextLevel: totalXpAtLevelStart + needed
  };
}

module.exports = {
  xpForNextLevel,
  totalXpRequiredForLevel,
  levelFromTotalXp,
  progressWithinLevel,
  maxTotalXp,
  clampTotalXp
};
