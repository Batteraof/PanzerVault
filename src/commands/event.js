const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const eventService = require('../modules/community/services/eventService');
const eventCreateFlow = require('../modules/interactions/flows/eventCreateFlow');
const { beginEphemeralReply } = require('../lib/beginEphemeralReply');
const logger = require('../logger');

function addEventIdOption(subcommand) {
  return subcommand.addIntegerOption(option =>
    option
      .setName('event_id')
      .setDescription('Event ID shown in the event footer.')
      .setRequired(true)
      .setMinValue(1)
  );
}

function addTimezoneOption(subcommand) {
  return subcommand.addStringOption(option =>
    option
      .setName('timezone')
      .setDescription('Timezone for the typed start time.')
      .setRequired(false)
      .addChoices(
        { name: 'Europe/Amsterdam', value: 'Europe/Amsterdam' },
        { name: 'Europe/London', value: 'Europe/London' },
        { name: 'UTC', value: 'UTC' },
        { name: 'America/New_York', value: 'America/New_York' },
        { name: 'America/Los_Angeles', value: 'America/Los_Angeles' }
      )
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Create or manage scheduled server events.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new event with a guided modal.')
        .addStringOption(option =>
          option
            .setName('template')
            .setDescription('Start with a common event template.')
            .setRequired(false)
            .addChoices(
              { name: 'Casual Tank Session', value: 'casual' },
              { name: 'Training Night', value: 'training' },
              { name: 'Clan Match', value: 'match' },
              { name: 'Community Operation', value: 'operation' }
            )
        )
        .addStringOption(option =>
          option
            .setName('timezone')
            .setDescription('Timezone for the typed start time.')
            .setRequired(false)
            .addChoices(
              { name: 'Europe/Amsterdam', value: 'Europe/Amsterdam' },
              { name: 'Europe/London', value: 'Europe/London' },
              { name: 'UTC', value: 'UTC' },
              { name: 'America/New_York', value: 'America/New_York' },
              { name: 'America/Los_Angeles', value: 'America/Los_Angeles' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List upcoming scheduled events.')
    )
    .addSubcommand(subcommand =>
      addEventIdOption(
        subcommand
          .setName('info')
          .setDescription('Show details for one event.')
      )
    )
    .addSubcommand(subcommand =>
      addEventIdOption(
        subcommand
          .setName('attendees')
          .setDescription('Show RSVP and check-in lists for one event.')
      )
    )
    .addSubcommand(subcommand =>
      addTimezoneOption(
        addEventIdOption(
          subcommand
            .setName('edit')
            .setDescription('Edit a scheduled event.')
        )
          .addStringOption(option =>
            option
              .setName('title')
              .setDescription('New event title.')
              .setRequired(false)
              .setMaxLength(120)
          )
          .addStringOption(option =>
            option
              .setName('starts_at')
              .setDescription('New start time: YYYY-MM-DD HH:MM.')
              .setRequired(false)
          )
          .addStringOption(option =>
            option
              .setName('description')
              .setDescription('New description. Use a single space to clear it.')
              .setRequired(false)
              .setMaxLength(500)
          )
          .addStringOption(option =>
            option
              .setName('link')
              .setDescription('New external link. Use a single space to clear it.')
              .setRequired(false)
          )
      )
    )
    .addSubcommand(subcommand =>
      addEventIdOption(
        subcommand
          .setName('cancel')
          .setDescription('Cancel a scheduled event.')
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
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'create') {
        await eventCreateFlow.start(interaction);
        return;
      }

      await beginEphemeralReply(interaction, 'Updating event...');

      if (subcommand === 'list') {
        const message = await eventService.listEvents(interaction);
        await interaction.editReply({ content: message, allowedMentions: { parse: [] } });
        return;
      }

      if (subcommand === 'info') {
        const message = await eventService.eventInfo(interaction);
        await interaction.editReply({ content: message, allowedMentions: { parse: [] } });
        return;
      }

      if (subcommand === 'attendees') {
        const message = await eventService.eventAttendees(interaction);
        await interaction.editReply({ content: message, allowedMentions: { parse: [] } });
        return;
      }

      if (subcommand === 'edit') {
        const result = await eventService.editEvent(interaction);
        await interaction.editReply(`Event #${result.id} has been updated.`);
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
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`Error: ${error.message || 'Something went wrong while handling that event.'}`);
        return;
      }
      await interaction.reply({
        content: `Error: ${error.message || 'Something went wrong while handling that event.'}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
