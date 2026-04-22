const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const rankEmbedService = require('../modules/leveling/services/rankEmbedService');
const rankAdminService = require('../modules/admin/services/rankAdminService');
const logger = require('../logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show or reset leveling rank data.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show level, XP progress, streak, voice time, and message count.')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The member to inspect.')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Admin: reset a member leveling profile.')
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
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Rank commands can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'show') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const rankData = await rankEmbedService.buildRankData(interaction.guild.id, targetUser.id);
      const embed = rankEmbedService.buildRankEmbed(rankData, targetUser);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'reset') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: 'You need Manage Server permission to reset ranks.',
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || null;
        const result = await rankAdminService.resetRank(interaction, targetUser, reason);

        await interaction.editReply(
          `Success: reset ${targetUser}'s rank. Previous total XP: ${result.previousTotalXp}.`
        );
      } catch (error) {
        logger.warn('Rank reset failed', error);
        await interaction.editReply(`Error: ${error.message || 'Rank reset failed.'}`);
      }
    }
  }
};
