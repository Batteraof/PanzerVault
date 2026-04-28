const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const customIds = require('./customIds');
const teamRoleService = require('../modules/config/services/teamRoleService');

async function buildTeamRolePicker(guildId) {
  const teamRoles = await teamRoleService.listTeamRoles(guildId);

  if (teamRoles.length === 0) {
    return {
      content: 'No team roles are configured yet. Staff can add them in the dashboard.',
      components: []
    };
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

  return {
    content: `Choose the team role that fits you.${extraNote}`,
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

module.exports = {
  buildTeamRolePicker
};
