const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const eventService = require('../modules/community/services/eventService');
const logger = require('../logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Create or manage scheduled server events.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new event with RSVP buttons.')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Event title.')
            .setRequired(true)
            .setMaxLength(120)
        )
        .addStringOption(option =>
          option
            .setName('starts_at')
            .setDescription('Start time in server local time, format: YYYY-MM-DD HH:MM')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Optional event description.')
            .setRequired(false)
            .setMaxLength(500)
        )
        .addStringOption(option =>
          option
            .setName('link')
            .setDescription('Optional external link for signups or extra info.')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Cancel a scheduled event.')
        .addIntegerOption(option =>
          option
            .setName('event_id')
            .setDescription('Event ID shown in the event footer.')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Optional cancellation reason.')
            .setRequired(false)
            .setMaxLength(300)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'create') {
        const result = await eventService.createEvent(interaction);
        await interaction.editReply(`Event #${result.event.id} is live in <#${result.message.channel.id}>.`);
        return;
      }

      if (subcommand === 'cancel') {
        const result = await eventService.cancelEvent(interaction);
        await interaction.editReply(`Event #${result.id} has been cancelled.`);
        return;
      }

      await interaction.editReply('That event command is no longer active.');
    } catch (error) {
      logger.warn('Event command failed', error);
      await interaction.editReply(`Error: ${error.message || 'Something went wrong while handling that event.'}`);
    }
  }
};
