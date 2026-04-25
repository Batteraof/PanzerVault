const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const spotlightService = require('../modules/community/services/spotlightService');
const logger = require('../logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spotlight-manage')
    .setDescription('Staff tools for Community Spotlight.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('disqualify')
        .setDescription('Remove a nominee from the current spotlight cycle.')
        .addUserOption(option =>
          option
            .setName('member')
            .setDescription('Member to remove from the current cycle.')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Why the nomination is being removed.')
            .setRequired(false)
            .setMaxLength(250)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('resolve')
        .setDescription('Resolve a spotlight tie by choosing the winner.')
        .addUserOption(option =>
          option
            .setName('member')
            .setDescription('Winning member to announce.')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('sync')
        .setDescription('Refresh the current spotlight cycle panels.')
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'disqualify') {
        const member = interaction.options.getUser('member', true);
        const count = await spotlightService.disqualifyNominee(
          interaction.client,
          interaction.guild.id,
          member.id,
          interaction.user.id,
          interaction.options.getString('reason') || 'Removed by staff.'
        );

        await interaction.editReply(`Removed ${member} from the current spotlight cycle (${count} nomination(s)).`);
        return;
      }

      if (subcommand === 'resolve') {
        const member = interaction.options.getUser('member', true);
        await spotlightService.resolveTie(interaction.client, interaction.guild.id, member.id);
        await interaction.editReply(`Spotlight winner resolved for ${member}.`);
        return;
      }

      if (subcommand === 'sync') {
        await spotlightService.syncCycle(interaction.client, interaction.guild.id);
        await interaction.editReply('Spotlight panels refreshed.');
      }
    } catch (error) {
      logger.warn('Spotlight manage command failed', error);
      await interaction.editReply(`Error: ${error.message || 'Something went wrong while managing Community Spotlight.'}`);
    }
  }
};
