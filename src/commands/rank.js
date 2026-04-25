const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const rankEmbedService = require('../modules/leveling/services/rankEmbedService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show level, XP progress, streak, voice time, and messages.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The member to inspect.')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Rank can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const rankData = await rankEmbedService.buildRankData(interaction.guild.id, targetUser.id);
    const embed = rankEmbedService.buildRankEmbed(rankData, targetUser);

    await interaction.editReply({ embeds: [embed] });
  }
};
