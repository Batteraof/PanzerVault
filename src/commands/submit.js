const { SlashCommandBuilder } = require('discord.js');
const galleryWizardService = require('../modules/gallery/services/galleryWizardService');
const { GalleryUserError } = require('../modules/gallery/utils/galleryErrors');
const { beginEphemeralReply } = require('../lib/beginEphemeralReply');
const logger = require('../logger');

function userMessageForError(error) {
  if (error instanceof GalleryUserError || error.isGalleryUserError) {
    return error.message;
  }

  logger.error('Gallery submission command failed', error);
  return 'Something went wrong while opening the gallery submit wizard.';
}

function addAttachmentOptions(builder) {
  return builder
    .addAttachmentOption(option =>
      option
        .setName('image_1')
        .setDescription('PNG or JPG image.')
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option
        .setName('image_2')
        .setDescription('Optional PNG or JPG image.')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('image_3')
        .setDescription('Optional PNG or JPG image.')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('image_4')
        .setDescription('Optional PNG or JPG image.')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('image_5')
        .setDescription('Optional PNG or JPG image.')
        .setRequired(false)
    );
}

module.exports = {
  data: addAttachmentOptions(
    new SlashCommandBuilder()
      .setName('submit')
      .setDescription('Upload images, then finish your gallery post in a guided wizard.')
  ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Submissions can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    await beginEphemeralReply(interaction, 'Opening the submit wizard...');

    try {
      await galleryWizardService.start(interaction);
    } catch (error) {
      await interaction.editReply(userMessageForError(error));
    }
  }
};
