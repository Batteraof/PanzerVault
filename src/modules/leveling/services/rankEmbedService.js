const { EmbedBuilder } = require('discord.js');
const userRepository = require('../../../db/repositories/userRepository');
const { progressWithinLevel } = require('../utils/xpFormula');
const { buildProgressBar } = require('../utils/progressBar');

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds) || 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function buildRankData(guildId, userId) {
  const user = await userRepository.ensureUser(guildId, userId);
  const rank = await userRepository.getRank(guildId, userId);
  const progress = progressWithinLevel(Number(user.total_xp));

  return {
    guildId,
    userId,
    rank,
    level: progress.level,
    currentLevelXp: progress.currentLevelXp,
    xpNeededForNextLevel: progress.xpNeededForNextLevel,
    totalXp: Number(user.total_xp),
    streak: Number(user.streak_count),
    totalVoiceSeconds: Number(user.total_voice_seconds),
    messageCount: Number(user.message_count),
    progressPercentage: progress.progressPercentage,
    progressBar: buildProgressBar(progress.progressPercentage)
  };
}

function buildRankEmbed(rankData, discordUser) {
  const titleName = discordUser ? discordUser.username : `User ${rankData.userId}`;
  const nextLevelText = rankData.xpNeededForNextLevel === 0
    ? 'Max level'
    : `${rankData.currentLevelXp}/${rankData.xpNeededForNextLevel} XP`;

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${titleName}'s Rank`)
    .addFields(
      { name: 'Level', value: `${rankData.level}`, inline: true },
      { name: 'Rank', value: rankData.rank ? `#${rankData.rank}` : 'Unranked', inline: true },
      { name: 'Progress', value: `${nextLevelText}\n${rankData.progressBar}`, inline: false },
      { name: 'Streak', value: `${rankData.streak}`, inline: true },
      { name: 'Voice Time', value: formatDuration(rankData.totalVoiceSeconds), inline: true },
      { name: 'Messages', value: `${rankData.messageCount}`, inline: true }
    )
    .setTimestamp();
}

module.exports = {
  buildRankData,
  buildRankEmbed,
  formatDuration
};
