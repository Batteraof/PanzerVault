const { SlashCommandBuilder } = require('discord.js');
const videoService = require('../modules/community/services/videoService');
const { beginEphemeralReply } = require('../lib/beginEphemeralReply');
const logger = require('../logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('video')
    .setDescription('Share a YouTube video in the community video channel.')
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Title for the video post.')
        .setRequired(true)
        .setMaxLength(120)
    )
    .addStringOption(option =>
      option
        .setName('url')
        .setDescription('YouTube URL.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Optional description.')
        .setRequired(false)
        .setMaxLength(300)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    await beginEphemeralReply(interaction, 'Posting your video...');

    try {
      const result = await videoService.submit(interaction);
      await interaction.editReply(`Video #${result.submission.id} is now live in <#${result.message.channel.id}>.`);
    } catch (error) {
      logger.warn('Video submit failed', error);
      await interaction.editReply(`Error: ${error.message || 'Something went wrong while posting that video.'}`);
    }
  }
};
