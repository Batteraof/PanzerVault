const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const galleryModerationService = require('../modules/gallery/services/galleryModerationService');
const { GalleryUserError } = require('../modules/gallery/utils/galleryErrors');
const { beginEphemeralReply } = require('../lib/beginEphemeralReply');
const logger = require('../logger');

function userMessageForError(error) {
  if (error instanceof GalleryUserError || error.isGalleryUserError) {
    return error.message;
  }

  logger.error('Gallery command failed', error);
  return 'Something went wrong while handling the gallery command.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gallery')
    .setDescription('Moderate curated gallery posts.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
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
        content: 'Gallery moderation can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'remove') {
      await beginEphemeralReply(interaction, 'Removing gallery submission...');

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
          `Gallery submission #${result.submission.id} was removed. ${deleteText}`
        );
      } catch (error) {
        await interaction.editReply(userMessageForError(error));
      }

      return;
    }

    if (subcommand === 'blacklist') {
      await beginEphemeralReply(interaction, 'Updating gallery blacklist...');

      try {
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || null;
        await galleryModerationService.blacklistUser(interaction, targetUser, reason);
        await interaction.editReply(`${targetUser} is now blocked from gallery submissions.`);
      } catch (error) {
        await interaction.editReply(userMessageForError(error));
      }

      return;
    }

    if (subcommand === 'unblacklist') {
      await beginEphemeralReply(interaction, 'Updating gallery blacklist...');

      try {
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || null;
        await galleryModerationService.unblacklistUser(interaction, targetUser, reason);
        await interaction.editReply(`${targetUser} can submit to the gallery again.`);
      } catch (error) {
        await interaction.editReply(userMessageForError(error));
      }

      return;
    }

    await interaction.reply({
      content: 'That gallery command is no longer active. Refresh Discord and try again.',
      ephemeral: true
    });
  }
};
