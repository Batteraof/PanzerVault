const db = require('../../../db/client');
const userRepository = require('../../../db/repositories/userRepository');
const xpAuditRepository = require('../../../db/repositories/xpAuditRepository');
const rewardRoleService = require('../../rewards/services/rewardRoleService');
const logger = require('../../../logger');
const { PermissionFlagsBits } = require('discord.js');

function assertManageGuild(interaction) {
  if (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('You need Manage Server permission to reset ranks.');
  }
}

async function resetRank(interaction, targetUser, reason = null) {
  assertManageGuild(interaction);

  const result = await db.withTransaction(async client => {
    const existing = await userRepository.lockUser(interaction.guild.id, targetUser.id, client);
    const previousTotalXp = Number(existing.total_xp);
    const resetUser = await userRepository.resetProgress(interaction.guild.id, targetUser.id, client);

    await xpAuditRepository.insertAuditLog(
      {
        guildId: interaction.guild.id,
        userId: targetUser.id,
        sourceType: 'manual',
        sourceRef: interaction.id,
        xpDelta: -previousTotalXp,
        previousTotalXp,
        newTotalXp: 0,
        metadata: {
          action: 'rank_reset',
          moderatorId: interaction.user.id,
          reason: reason || null
        }
      },
      client
    );

    return {
      previousTotalXp,
      resetUser
    };
  });

  try {
    await rewardRoleService.syncMemberRewards(
      interaction.client,
      interaction.guild.id,
      targetUser.id,
      0
    );
  } catch (error) {
    logger.warn('Failed to sync reward roles after rank reset', error);
  }

  return result;
}

module.exports = {
  resetRank
};
