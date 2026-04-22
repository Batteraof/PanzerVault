const achievementRepository = require('../../../db/repositories/achievementRepository');

async function unlockAchievement(guildId, userId, achievementKey, metadata = null, client) {
  return achievementRepository.unlockAchievement(guildId, userId, achievementKey, metadata, client);
}

async function evaluateAfterXpAward(result, client) {
  if (!result || !result.updatedUser) return [];

  const unlocked = [];
  const { guildId, userId, previousTotalXp, updatedUser } = result;

  if (previousTotalXp === 0 && Number(updatedUser.total_xp) > 0) {
    const row = await unlockAchievement(guildId, userId, 'first_xp', null, client);
    if (row) unlocked.push(row);
  }

  if (result.previousLevel < 5 && Number(updatedUser.level) >= 5) {
    const row = await unlockAchievement(guildId, userId, 'level_5', { level: 5 }, client);
    if (row) unlocked.push(row);
  }

  if (Number(updatedUser.total_voice_seconds) >= 3600) {
    const row = await unlockAchievement(guildId, userId, 'voice_hour', { seconds: 3600 }, client);
    if (row) unlocked.push(row);
  }

  return unlocked;
}

module.exports = {
  unlockAchievement,
  evaluateAfterXpAward
};
