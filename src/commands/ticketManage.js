const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const ticketService = require('../modules/tickets/services/ticketService');
const { beginEphemeralReply } = require('../lib/beginEphemeralReply');
const logger = require('../logger');

function messageForError(error) {
  if (error.isTicketUserError) return error.message;
  logger.error('Ticket manage command failed', error);
  return 'Something went wrong while handling the ticket command.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-manage')
    .setDescription('Staff ticket tools.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close a ticket from the current channel or by ticket ID.')
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
        content: 'Ticket manage commands can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    await beginEphemeralReply(interaction, 'Updating ticket...');

    try {
      if (subcommand === 'close') {
        const reason = interaction.options.getString('reason') || null;
        const deleteChannel = interaction.options.getBoolean('delete_channel') || false;
        const ticketId = interaction.options.getInteger('ticket_id');
        const result = await ticketService.closeTicket(interaction, reason, deleteChannel, ticketId);
        await interaction.editReply(`Ticket #${result.id} was closed.`);
        return;
      }

      if (subcommand === 'add') {
        const targetUser = interaction.options.getUser('user', true);
        const ticket = await ticketService.addUser(interaction, targetUser);
        await interaction.editReply(`${targetUser} was added to ticket #${ticket.id}.`);
        return;
      }

      if (subcommand === 'remove') {
        const targetUser = interaction.options.getUser('user', true);
        const ticket = await ticketService.removeUser(interaction, targetUser);
        await interaction.editReply(`${targetUser} was removed from ticket #${ticket.id}.`);
        return;
      }

      await interaction.editReply('That ticket-manage command is no longer active. Refresh Discord and try again.');
    } catch (error) {
      await interaction.editReply(messageForError(error));
    }
  }
};
