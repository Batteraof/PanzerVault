const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const ticketCreateFlow = require('../modules/interactions/flows/ticketCreateFlow');
const logger = require('../logger');

function messageForError(error) {
  if (error.isTicketUserError) return error.message;
  logger.error('Ticket command failed', error);
  return 'Something went wrong while handling the ticket command.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open a private staff support ticket.'),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Ticket commands can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await ticketCreateFlow.start(interaction);
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
