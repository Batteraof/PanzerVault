const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const videoSubmitFlow = require('../modules/interactions/flows/videoSubmitFlow');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('video')
    .setDescription('Share a YouTube video with a guided submission flow.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    await videoSubmitFlow.start(interaction);
  }
};
