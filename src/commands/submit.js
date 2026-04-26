const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const submitEntryFlow = require('../modules/interactions/flows/submitEntryFlow');
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
      .setDescription('Start a guided gallery or video submission flow.')
  ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Submissions can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await beginEphemeralReply(interaction, 'Opening the submit flow...');
    await submitEntryFlow.start(interaction);
  }
};