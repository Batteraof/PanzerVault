const {
  ActionRowBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const customIds = require('../lib/customIds');
const teamRoleService = require('../modules/config/services/teamRoleService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Choose your team role.'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const teamRoles = await teamRoleService.listTeamRoles(interaction.guild.id);

    if (teamRoles.length === 0) {
      await interaction.reply({
        content: 'No team roles are configured yet. Staff can add them in the dashboard.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const visibleTeamRoles = teamRoles.slice(0, 25);
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customIds.TEAM_SELECT)
      .setPlaceholder('Choose your team')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        visibleTeamRoles.map(team => ({
          label: team.label,
          value: team.option_key
        }))
      );

    const extraNote = teamRoles.length > visibleTeamRoles.length
      ? '\nOnly the first 25 teams are shown here. Ask staff to remove old options or adjust ordering.'
      : '';

    await interaction.reply({
      content: `Choose the team role that fits you.${extraNote}`,
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral
    });
  }
};
