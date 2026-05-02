const { EmbedBuilder, MessageFlags, SlashCommandBuilder } = require('discord.js');
const userRepository = require('../db/repositories/userRepository');
const { progressWithinLevel } = require('../modules/leveling/utils/xpFormula');

function buildLeaderboardEmbed(guild, rows, viewerRank = null, viewerRow = null) {
  const lines = rows.map((row, index) => {
    const progress = progressWithinLevel(Number(row.total_xp));
    return `${index + 1}. <@${row.user_id}>  |  Level ${progress.level}  |  ${row.total_xp} XP`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${guild.name} Leaderboard`)
    .setDescription(lines.length > 0 ? lines.join('\n') : 'No ranked users yet.')
    .setFooter({ text: 'Showing top 10 members.' })
    .setTimestamp();

  if (viewerRank && viewerRow) {
    const viewerProgress = progressWithinLevel(Number(viewerRow.total_xp));
    embed.addFields({
      name: 'Your Rank',
      value: `${viewerRank}. <@${viewerRow.user_id}>  |  Level ${viewerProgress.level}  |  ${viewerRow.total_xp} XP`,
      inline: false
    });
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Leaderboard can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply();

    const rows = await userRepository.getLeaderboard(interaction.guild.id, 10, 0);
    const [viewerRank, viewerRow] = await Promise.all([
      userRepository.getRank(interaction.guild.id, interaction.user.id),
      userRepository.getUser(interaction.guild.id, interaction.user.id)
    ]);
    const embed = buildLeaderboardEmbed(interaction.guild, rows, viewerRank, viewerRow);

    await interaction.editReply({ embeds: [embed] });
  }
};
