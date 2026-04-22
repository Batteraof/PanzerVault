const { SlashCommandBuilder } = require('discord.js');
const galleryService = require('../modules/gallery/services/galleryService');
const galleryModerationService = require('../modules/gallery/services/galleryModerationService');
const { CATEGORIES } = require('../modules/gallery/constants/galleryConfig');
const { GalleryUserError } = require('../modules/gallery/utils/galleryErrors');
const logger = require('../logger');

function userMessageForError(error) {
  if (error instanceof GalleryUserError || error.isGalleryUserError) {
    return error.message;
  }

  logger.error('Gallery command failed', error);
  return 'Something went wrong while handling the gallery command.';
}

function addSubmitOptions(subcommand) {
  return subcommand
    .setName('submit')
    .setDescription('Submit images to the community gallery.')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Gallery category.')
        .setRequired(true)
        .addChoices(
          { name: 'Showcase', value: CATEGORIES.SHOWCASE },
          { name: 'Meme', value: CATEGORIES.MEME }
        )
    )
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
    )
    .addStringOption(option =>
      option
        .setName('caption')
        .setDescription('Optional caption, max 300 characters. Mentions are not allowed.')
        .setRequired(false)
        .setMaxLength(300)
    )
    .addStringOption(option =>
      option
        .setName('video_link')
        .setDescription('Optional YouTube link.')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('tags')
        .setDescription('Optional comma-separated approved tags, for example: US Tanks, GER Tanks.')
        .setRequired(false)
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gallery')
    .setDescription('Submit and manage curated gallery posts.')
    .addSubcommand(addSubmitOptions)
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a posted gallery submission.')
        .addIntegerOption(option =>
          option
            .setName('submission_id')
            .setDescription('Gallery submission ID.')
            .setRequired(false)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('message_id')
            .setDescription('Gallery message ID.')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Optional removal reason.')
            .setRequired(false)
            .setMaxLength(300)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('tags')
        .setDescription('List approved gallery tags.')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Filter by category.')
            .setRequired(false)
            .addChoices(
              { name: 'Showcase', value: CATEGORIES.SHOWCASE },
              { name: 'Meme', value: CATEGORIES.MEME }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('blacklist')
        .setDescription('Block a user from submitting to the gallery.')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to block from gallery submissions.')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Optional reason.')
            .setRequired(false)
            .setMaxLength(300)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unblacklist')
        .setDescription('Allow a user to submit to the gallery again.')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to allow.')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Optional reason.')
            .setRequired(false)
            .setMaxLength(300)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Gallery commands can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'submit') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const result = await galleryService.submit(interaction);
        await interaction.editReply(
          `Success: Gallery submission #${result.submission.id} posted successfully.`
        );
      } catch (error) {
        await interaction.editReply(`Error: ${userMessageForError(error)}`);
      }

      return;
    }

    if (subcommand === 'remove') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const result = await galleryModerationService.removeSubmission(interaction, {
          submissionId: interaction.options.getInteger('submission_id'),
          messageId: interaction.options.getString('message_id'),
          reason: interaction.options.getString('reason')
        });

        const deleteText = result.deletionResult.deleted
          ? 'The public post was deleted.'
          : `The database status was updated, but the public post was not deleted (${result.deletionResult.reason}).`;

        await interaction.editReply(
          `Success: Gallery submission #${result.submission.id} removed. ${deleteText}`
        );
      } catch (error) {
        await interaction.editReply(`Error: ${userMessageForError(error)}`);
      }

      return;
    }

    if (subcommand === 'tags') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const category = interaction.options.getString('category');
        const tags = await galleryService.listTags(interaction.guild.id, category);
        const tagText = tags.length > 0
          ? tags.map(tag => tag.tag_name).join(', ')
          : 'No approved tags are configured yet.';

        await interaction.editReply(`Approved gallery tags: ${tagText}`);
      } catch (error) {
        await interaction.editReply(`Error: ${userMessageForError(error)}`);
      }

      return;
    }

    if (subcommand === 'blacklist') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || null;
        await galleryModerationService.blacklistUser(interaction, targetUser, reason);
        await interaction.editReply(`Success: ${targetUser} is now blocked from gallery submissions.`);
      } catch (error) {
        await interaction.editReply(`Error: ${userMessageForError(error)}`);
      }

      return;
    }

    if (subcommand === 'unblacklist') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || null;
        await galleryModerationService.unblacklistUser(interaction, targetUser, reason);
        await interaction.editReply(`Success: ${targetUser} can submit to the gallery again.`);
      } catch (error) {
        await interaction.editReply(`Error: ${userMessageForError(error)}`);
      }
    }
  }
};
