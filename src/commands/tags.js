const { SlashCommandBuilder } = require('discord.js');
const galleryService = require('../modules/gallery/services/galleryService');
const { CATEGORIES } = require('../modules/gallery/constants/galleryConfig');
const { GalleryUserError } = require('../modules/gallery/utils/galleryErrors');
const { beginEphemeralReply } = require('../lib/beginEphemeralReply');
const logger = require('../logger');

function userMessageForError(error) {
  if (error instanceof GalleryUserError || error.isGalleryUserError) {
    return error.message;
  }

  logger.error('Gallery tag command failed', error);
  return 'Something went wrong while loading gallery tags.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tags')
    .setDescription('List the approved gallery tags.')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Filter by category.')
        .setRequired(false)
        .addChoices(
          { name: 'Showcase', value: CATEGORIES.SHOWCASE },
          { name: 'Meme', value: CATEGORIES.MEME }
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Tags can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    await beginEphemeralReply(interaction, 'Loading approved tags...');

    try {
      const category = interaction.options.getString('category');
      const tags = await galleryService.listTags(interaction.guild.id, category);
      const tagText = tags.length > 0
        ? tags.map(tag => tag.tag_name).join(', ')
        : 'No approved tags are configured yet.';
      const categoryText = category ? `${category} tags` : 'Approved gallery tags';

      await interaction.editReply(`${categoryText}: ${tagText}`);
    } catch (error) {
      await interaction.editReply(userMessageForError(error));
    }
  }
};
