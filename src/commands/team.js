const {
  MessageFlags,
  SlashCommandBuilder
} = require('discord.js');
const { buildTeamRolePicker } = require('../lib/teamRolePicker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Choose your team role.'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const picker = await buildTeamRolePicker(interaction.guild.id);

    await interaction.reply({
      ...picker,
      flags: MessageFlags.Ephemeral
    });
  }
};
