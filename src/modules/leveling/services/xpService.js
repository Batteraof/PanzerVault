const db = require('../../../db/client');
const userRepository = require('../../../db/repositories/userRepository');
const cooldownRepository = require('../../../db/repositories/cooldownRepository');
const guildSettingsRepository = require('../../../db/repositories/guildSettingsRepository');
const xpAuditRepository = require('../../../db/repositories/xpAuditRepository');
const achievementService = require('./achievementService');
const levelService = require('./levelService');
const streakService = require('./streakService');
const rewardRoleService = require('../../rewards/services/rewardRoleService');
const { TEXT_COOLDOWN_SECONDS } = require('../constants/levelingConfig');
const { textXpForMessage, countWords } = require('../utils/wordCount');
const { progressWithinLevel, clampTotalXp } = require('../utils/xpFormula');
const antiAbuse = require('../utils/antiAbuse');
const logger = require('../../../logger');

async function awardXpInTransaction(params, client) {
  const {
    guildId,
    userId,
    xpDelta,
    sourceType,
    sourceRef = null,
    metadata = null,
    messageCountIncrement = 0,
    voiceSecondsIncrement = 0,
    settings = null,
    activityAt = new Date()
  } = params;

  if (!xpDelta || xpDelta <= 0) {
    return { awarded: false, reason: 'no_xp' };
  }

  const activeSettings = settings || await guildSettingsRepository.ensureSettings(guildId, client);
  if (!activeSettings.leveling_enabled) {
    return { awarded: false, reason: 'leveling_disabled' };
  }

  if (sourceType === 'text' && !activeSettings.text_xp_enabled) {
    return { awarded: false, reason: 'text_xp_disabled' };
  }

  if (sourceType === 'voice' && !activeSettings.voice_xp_enabled) {
    return { awarded: false, reason: 'voice_xp_disabled' };
  }

  const user = await userRepository.lockUser(guildId, userId, client);
  const previousTotalXp = Number(user.total_xp);
  const previousLevel = Number(user.level);
  const newTotalXp = clampTotalXp(previousTotalXp + xpDelta);
  const actualDelta = newTotalXp - previousTotalXp;

  if (actualDelta <= 0) {
    return { awarded: false, reason: 'max_level' };
  }

  const progress = progressWithinLevel(newTotalXp);
  const streak = streakService.calculateNextStreak(user, activityAt);

  const updatedUser = await userRepository.updateProgress(
    guildId,
    userId,
    {
      level: progress.level,
      currentLevelXp: progress.currentLevelXp,
      totalXp: newTotalXp,
      messageCountIncrement,
      voiceSecondsIncrement,
      streakCount: streak.streakCount,
      lastActivityAt: streak.lastActivityAt,
      lastStreakAt: streak.lastStreakAt
    },
    client
  );

  const audit = await xpAuditRepository.insertAuditLog(
    {
      guildId,
      userId,
      sourceType,
      sourceRef,
      xpDelta: actualDelta,
      previousTotalXp,
      newTotalXp,
      metadata
    },
    client
  );

  const result = {
    awarded: true,
    guildId,
    userId,
    sourceType,
    xpDelta: actualDelta,
    previousTotalXp,
    newTotalXp,
    previousLevel,
    newLevel: progress.level,
    leveledUp: progress.level > previousLevel,
    updatedUser,
    audit,
    settings: activeSettings
  };

  result.unlockedAchievements = await achievementService.evaluateAfterXpAward(result, client);

  return result;
}

async function finalizeAward(client, result) {
  if (!result || !result.awarded) return result;

  if (result.leveledUp) {
    await levelService.handleLevelUp(client, result);
  }

  if (result.leveledUp) {
    await rewardRoleService.syncAfterAward(client, result);
  }

  return result;
}

async function awardTextXpFromMessage(message) {
  if (!antiAbuse.isEligibleTextMessage(message)) {
    return { awarded: false, reason: 'ineligible_message' };
  }

  if (antiAbuse.shouldSkipForRepeatedSimilarity(message)) {
    return { awarded: false, reason: 'similarity_filter' };
  }

  const wordCount = countWords(message.content);
  const xpDelta = textXpForMessage(message.content);
  if (xpDelta <= 0) return { awarded: false, reason: 'no_xp' };

  const result = await db.withTransaction(async client => {
    const settings = await guildSettingsRepository.ensureSettings(message.guild.id, client);
    if (!settings.leveling_enabled || !settings.text_xp_enabled) {
      return { awarded: false, reason: 'text_xp_disabled' };
    }

    const cooldownAcquired = await cooldownRepository.tryAcquireTextCooldown(
      message.guild.id,
      message.author.id,
      TEXT_COOLDOWN_SECONDS,
      client
    );

    if (!cooldownAcquired) {
      return { awarded: false, reason: 'cooldown' };
    }

    return awardXpInTransaction(
      {
        guildId: message.guild.id,
        userId: message.author.id,
        xpDelta,
        sourceType: 'text',
        sourceRef: message.id,
        messageCountIncrement: 1,
        settings,
        metadata: {
          channelId: message.channel.id,
          wordCount
        }
      },
      client
    );
  });

  try {
    return await finalizeAward(message.client, result);
  } catch (error) {
    logger.warn('XP awarded, but post-award handling failed', error);
    return result;
  }
}

async function awardManualXp(params) {
  const result = await db.withTransaction(client => awardXpInTransaction(params, client));
  return finalizeAward(params.client, result);
}

module.exports = {
  awardXpInTransaction,
  finalizeAward,
  awardTextXpFromMessage,
  awardManualXp
};
