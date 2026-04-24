const { SlashCommandBuilder } = require('discord.js');
const ticketService = require('../modules/tickets/services/ticketService');
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
        .setDescription('Open a support ticket.')
        .addStringOption(option =>
          option
            .setName('subject')
            .setDescription('Short description of what you need help with.')
            .setRequired(false)
            .setMaxLength(120)
        )
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
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    await beginEphemeralReply(interaction, 'Working on your ticket...');

    try {
      if (subcommand === 'open') {
        const subject = interaction.options.getString('subject') || null;
        const result = await ticketService.openTicket(interaction, subject);
        await interaction.editReply(`Ticket #${result.ticket.id} is open in ${result.channel}.`);
        return;
      }

      if (subcommand === 'close') {
        const reason = interaction.options.getString('reason') || null;
        const result = await ticketService.closeTicket(interaction, reason, false, null);
        await interaction.editReply(`Ticket #${result.id} was closed.`);
        return;
      }

      await interaction.editReply('That ticket command is no longer active. Refresh Discord and try again.');
    } catch (error) {
      await interaction.editReply(messageForError(error));
    }
  }
};
