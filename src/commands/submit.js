const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const submitEntryFlow = require('../modules/interactions/flows/submitEntryFlow');
const { beginEphemeralReply } = require('../lib/beginEphemeralReply');
const communitySettingsService = require('../modules/config/services/communitySettingsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Optionally submit art, screenshots, or a video for showcase and promo use.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Submissions can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const settings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
    if (settings.media_channel_id && interaction.channelId !== settings.media_channel_id) {
      await interaction.reply({
        content: `Use \`/submit\` in <#${settings.media_channel_id}> so media submissions stay organized.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await beginEphemeralReply(interaction, 'Opening the submit flow...');
    await submitEntryFlow.start(interaction);
  }
};
