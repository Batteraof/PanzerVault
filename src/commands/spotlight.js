const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const spotlightService = require('../modules/community/services/spotlightService');
const logger = require('../logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spotlight')
    .setDescription('Nominate members for the monthly Community Spotlight.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('nominate')
        .setDescription('Nominate one member for this month.')
        .addUserOption(option =>
          option
            .setName('member')
            .setDescription('Member you want to nominate.')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Main reason for the nomination.')
            .setRequired(true)
            .addChoices(
              ...spotlightService.REASON_TAGS.map(tag => ({
                name: tag.label,
                value: tag.key
              }))
            )
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Short reason for your nomination.')
            .setRequired(true)
            .setMaxLength(250)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Show the current spotlight phase and dates.')
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'nominate') {
        const nomination = await spotlightService.nominate(interaction);
        await interaction.editReply(
          `Nomination saved for <@${nomination.nominee_user_id}> under **${nomination.reason_tag}**.`
        );
        return;
      }

      if (subcommand === 'info') {
        const info = await spotlightService.getInfo(interaction.guild.id);
        const embed = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle('Community Spotlight')
          .addFields(
            { name: 'Month', value: info.cycle.month_key, inline: true },
            { name: 'Phase', value: info.phase, inline: true },
            { name: 'Nominations Close', value: new Date(info.cycle.nomination_ends_at).toLocaleString(), inline: false },
            { name: 'Voting Opens', value: new Date(info.cycle.voting_starts_at).toLocaleString(), inline: false },
            { name: 'Winner Announcement', value: new Date(info.cycle.announcement_at).toLocaleString(), inline: false }
          )
          .setTimestamp();

        if (info.finalists.length > 0) {
          embed.addFields({
            name: 'Current Finalists',
            value: info.finalists.map(row => `<@${row.nominee_user_id}>`).join('\n'),
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      logger.warn('Spotlight command failed', error);
      await interaction.editReply(`Error: ${error.message || 'Something went wrong while handling Community Spotlight.'}`);
    }
  }
};
