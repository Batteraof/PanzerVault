const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const rankEmbedService = require('../modules/leveling/services/rankEmbedService');
const gallerySubmissionRepository = require('../db/repositories/gallerySubmissionRepository');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show a member profile with leveling and gallery stats.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The member to inspect.')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Profile can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const rankData = await rankEmbedService.buildRankData(interaction.guild.id, targetUser.id);
    const galleryStats = await gallerySubmissionRepository.getUserSubmissionStats(
      interaction.guild.id,
      targetUser.id
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${targetUser.username}'s Profile`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Level', value: `${rankData.level}`, inline: true },
        { name: 'Rank', value: rankData.rank ? `#${rankData.rank}` : 'Unranked', inline: true },
        { name: 'Total XP', value: `${rankData.totalXp}`, inline: true },
        {
          name: 'Progress',
          value: `${rankData.currentLevelXp}/${rankData.xpNeededForNextLevel || rankData.currentLevelXp} XP (${rankData.progressPercentage}%)\n${rankData.progressBar}`,
          inline: false
        },
        { name: 'Streak', value: `${rankData.streak}`, inline: true },
        { name: 'Voice Time', value: rankEmbedService.formatDuration(rankData.totalVoiceSeconds), inline: true },
        { name: 'Messages', value: `${rankData.messageCount}`, inline: true },
        { name: 'Gallery Posts', value: `${galleryStats.posted_submissions}`, inline: true },
        { name: 'Gallery Removed', value: `${galleryStats.removed_submissions}`, inline: true }
      )
      .setFooter({ text: 'Leveling and gallery stats in one view.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
