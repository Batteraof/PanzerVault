const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const rankAdminService = require('../modules/admin/services/rankAdminService');
const logger = require('../logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank-reset')
    .setDescription('Admin: reset a member leveling profile.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The member to reset.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Optional audit reason.')
        .setRequired(false)
        .setMaxLength(300)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Rank reset can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need Manage Server permission to reset ranks.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const targetUser = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || null;
      const result = await rankAdminService.resetRank(interaction, targetUser, reason);

      await interaction.editReply(
        `Rank reset complete for ${targetUser}. Previous total XP: ${result.previousTotalXp}.`
      );
    } catch (error) {
      logger.warn('Rank reset failed', error);
      await interaction.editReply(error.message || 'Rank reset failed.');
    }
  }
};
