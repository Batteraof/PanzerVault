const {
  MessageFlags,
  SlashCommandBuilder
} = require('discord.js');
const { buildTeamRolePicker } = require('../lib/teamRolePicker');
const memberTeamRoleService = require('../modules/config/services/memberTeamRoleService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Choose or clear your team role.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('choose')
        .setDescription('Choose your team role.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Remove your current team role.')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'clear') {
      const result = await memberTeamRoleService.clearMemberTeamRoles(interaction.member);
      await interaction.reply({
        content: result.ok
          ? (result.removed.length > 0 ? `Removed ${result.removed.join(', ')}.` : 'You do not have a configured team role right now.')
          : result.message,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const picker = await buildTeamRolePicker(interaction.guild.id);
    await interaction.reply({
      ...picker,
      flags: MessageFlags.Ephemeral
    });
  }
};
