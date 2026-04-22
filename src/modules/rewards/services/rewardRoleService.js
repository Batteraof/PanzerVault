const { PermissionFlagsBits } = require('discord.js');
const levelRoleRewardRepository = require('../../../db/repositories/levelRoleRewardRepository');
const logger = require('../../../logger');

function canManageRole(botMember, role) {
  if (!botMember || !role) return false;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) return false;
  return botMember.roles.highest.comparePositionTo(role) > 0;
}

async function addReward(guildId, roleId, requiredLevel, createdBy) {
  return levelRoleRewardRepository.upsertReward(guildId, roleId, requiredLevel, createdBy);
}

async function removeReward(guildId, roleId, removedBy, reason = null) {
  return levelRoleRewardRepository.deactivateReward(guildId, roleId, removedBy, reason);
}

async function listRewards(guildId) {
  return levelRoleRewardRepository.listActiveRewards(guildId);
}

async function logRewardAction(guildId, userId, reward, action, reason) {
  return levelRoleRewardRepository.insertRewardLog({
    guildId,
    userId,
    roleId: reward.role_id,
    rewardId: reward.id,
    action,
    reason
  });
}

async function syncMemberRewards(discordClient, guildId, userId, level) {
  const rewards = await listRewards(guildId);
  if (rewards.length === 0) {
    return { assigned: [], removed: [], skipped: [] };
  }

  const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
  if (!guild) return { assigned: [], removed: [], skipped: ['missing_guild'] };

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member || member.user.bot) return { assigned: [], removed: [], skipped: ['missing_member'] };

  const botMember = await guild.members.fetchMe().catch(() => guild.members.me);
  const result = { assigned: [], removed: [], skipped: [] };

  for (const reward of rewards) {
    const role = await guild.roles.fetch(reward.role_id).catch(() => null);

    if (!role) {
      result.skipped.push(reward.role_id);
      await logRewardAction(guildId, userId, reward, 'skip', 'Reward role no longer exists.');
      continue;
    }

    const shouldHaveRole = Number(level) >= Number(reward.required_level);
    const hasRole = member.roles.cache.has(role.id);

    if (shouldHaveRole && !hasRole) {
      if (!canManageRole(botMember, role)) {
        result.skipped.push(role.id);
        await logRewardAction(guildId, userId, reward, 'skip', 'Bot cannot manage reward role.');
        continue;
      }

      await member.roles.add(role, `Level reward for level ${reward.required_level}`);
      result.assigned.push(role.id);
      await logRewardAction(guildId, userId, reward, 'assign', `Reached level ${level}.`);
      continue;
    }

    if (!shouldHaveRole && hasRole) {
      if (!canManageRole(botMember, role)) {
        result.skipped.push(role.id);
        await logRewardAction(guildId, userId, reward, 'skip', 'Bot cannot remove reward role.');
        continue;
      }

      await member.roles.remove(role, `No longer meets level reward ${reward.required_level}`);
      result.removed.push(role.id);
      await logRewardAction(guildId, userId, reward, 'remove', `Current level ${level}.`);
    }
  }

  return result;
}

async function syncAfterAward(discordClient, awardResult) {
  if (!awardResult || !awardResult.awarded) return null;

  try {
    return await syncMemberRewards(
      discordClient,
      awardResult.guildId,
      awardResult.userId,
      awardResult.newLevel
    );
  } catch (error) {
    logger.warn('Failed to sync level reward roles after XP award', error);
    return null;
  }
}

module.exports = {
  addReward,
  removeReward,
  listRewards,
  syncMemberRewards,
  syncAfterAward
};
