const { EmbedBuilder, MessageFlags, SlashCommandBuilder } = require('discord.js');
const userRepository = require('../db/repositories/userRepository');
const { progressWithinLevel } = require('../modules/leveling/utils/xpFormula');

function buildLeaderboardEmbed(guild, rows) {
  const lines = rows.map((row, index) => {
    const progress = progressWithinLevel(Number(row.total_xp));
    return `${index + 1}. <@${row.user_id}>  |  Level ${progress.level}  |  ${row.total_xp} XP`;
  });

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${guild.name} Leaderboard`)
    .setDescription(lines.length > 0 ? lines.join('\n') : 'No ranked users yet.')
    .setFooter({ text: `Showing top ${rows.length} member${rows.length === 1 ? '' : 's'}.` })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard.')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of users to show.')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Leaderboard can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply();

    const limit = interaction.options.getInteger('limit') || 10;
    const rows = await userRepository.getLeaderboard(interaction.guild.id, limit, 0);
    const embed = buildLeaderboardEmbed(interaction.guild, rows);

    await interaction.editReply({ embeds: [embed] });
  }
};
