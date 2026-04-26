const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const submitEntryFlow = require('../modules/interactions/flows/submitEntryFlow');
const communitySettingsService = require('../modules/config/services/communitySettingsService');
const { beginEphemeralReply } = require('../lib/beginEphemeralReply');

function addAttachmentOptions(builder) {
  return builder
    .addAttachmentOption(option =>
      option
        .setName('image_1')
        .setDescription('Optional PNG or JPG image for a gallery submission.')
        .setRequired(false)
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
      .setDescription('Get help with the media posting flow or use the fallback guided wizard.')
  ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Submissions can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await beginEphemeralReply(interaction, 'Checking the media flow for this server...');
    const communitySettings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);

    if (communitySettings.media_channel_id) {
      await interaction.editReply({
        content: `Direct media uploads are live in <#${communitySettings.media_channel_id}>. Drop screenshots, art, uploaded videos, or YouTube links there and I will prompt you for a title, tags, and an optional description.`
      });
      return;
    }

    await interaction.editReply('Opening the legacy submit flow...');
    await submitEntryFlow.start(interaction);
  }
};