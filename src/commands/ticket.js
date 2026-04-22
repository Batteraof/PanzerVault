const { SlashCommandBuilder } = require('discord.js');
const ticketService = require('../modules/tickets/services/ticketService');
const logger = require('../logger');

function messageForError(error) {
  if (error.isTicketUserError) return error.message;
  logger.error('Ticket command failed', error);
  return 'Something went wrong while handling the ticket command.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open and manage support tickets.')
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
        .setDescription('Close the current ticket, or a ticket by ID.')
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Optional close reason.')
            .setRequired(false)
            .setMaxLength(300)
        )
        .addBooleanOption(option =>
          option
            .setName('delete_channel')
            .setDescription('Delete the ticket channel after closing.')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('ticket_id')
            .setDescription('Optional ticket ID to close.')
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a user to the current ticket.')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to add.')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a user from the current ticket.')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to remove.')
            .setRequired(true)
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
    await interaction.deferReply({ ephemeral: true });

    try {
      if (subcommand === 'open') {
        const subject = interaction.options.getString('subject') || null;
        const result = await ticketService.openTicket(interaction, subject);
        await interaction.editReply(`Success: opened ticket #${result.ticket.id} in ${result.channel}.`);
        return;
      }

      if (subcommand === 'close') {
        const reason = interaction.options.getString('reason') || null;
        const deleteChannel = interaction.options.getBoolean('delete_channel') || false;
        const ticketId = interaction.options.getInteger('ticket_id');
        const result = await ticketService.closeTicket(interaction, reason, deleteChannel, ticketId);
        await interaction.editReply(`Success: closed ticket #${result.id}.`);
        return;
      }

      if (subcommand === 'add') {
        const targetUser = interaction.options.getUser('user', true);
        const ticket = await ticketService.addUser(interaction, targetUser);
        await interaction.editReply(`Success: added ${targetUser} to ticket #${ticket.id}.`);
        return;
      }

      if (subcommand === 'remove') {
        const targetUser = interaction.options.getUser('user', true);
        const ticket = await ticketService.removeUser(interaction, targetUser);
        await interaction.editReply(`Success: removed ${targetUser} from ticket #${ticket.id}.`);
      }
    } catch (error) {
      await interaction.editReply(`Error: ${messageForError(error)}`);
    }
  }
};
