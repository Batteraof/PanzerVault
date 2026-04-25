const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const ticketService = require('../modules/tickets/services/ticketService');
const ticketCreateFlow = require('../modules/interactions/flows/ticketCreateFlow');
const { beginEphemeralReply } = require('../lib/beginEphemeralReply');
const logger = require('../logger');

function messageForError(error) {
  if (error.isTicketUserError) return error.message;
  logger.error('Ticket command failed', error);
  return 'Something went wrong while handling the ticket command.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open your own support ticket.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('open')
        .setDescription('Open a guided support ticket.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close your current ticket.')
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Optional close reason.')
            .setRequired(false)
            .setMaxLength(300)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Ticket commands can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'open') {
        await ticketCreateFlow.start(interaction);
        return;
      }

      await beginEphemeralReply(interaction, 'Working on your ticket...');

      if (subcommand === 'close') {
        const reason = interaction.options.getString('reason') || null;
        const result = await ticketService.closeTicket(interaction, reason, false, null);
        await interaction.editReply(`Ticket #${result.id} was closed.`);
        return;
      }

      await interaction.editReply('That ticket command is no longer active. Refresh Discord and try again.');
    } catch (error) {
      const content = messageForError(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(content);
        return;
      }
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  }
};
