const { MessageFlags } = require('discord.js');
const botCommand = require('../../commands/bot');
const rankCommand = require('../../commands/rank');
const rankResetCommand = require('../../commands/rankReset');
const galleryCommand = require('../../commands/gallery');
const submitCommand = require('../../commands/submit');
const tagsCommand = require('../../commands/tags');
const configCommand = require('../../commands/config');
const dashboardCommand = require('../../commands/dashboard');
const leaderboardCommand = require('../../commands/leaderboard');
const profileCommand = require('../../commands/profile');
const ticketCommand = require('../../commands/ticket');
const ticketManageCommand = require('../../commands/ticketManage');
const eventCommand = require('../../commands/event');
const spotlightCommand = require('../../commands/spotlight');
const spotlightManageCommand = require('../../commands/spotlightManage');
const { handleRoleInteraction } = require('./roleInteractions');
const galleryWizardService = require('../../modules/gallery/services/galleryWizardService');
const eventService = require('../../modules/community/services/eventService');
const spotlightService = require('../../modules/community/services/spotlightService');
const interactionFlowRouter = require('../../modules/interactions/interactionFlowRouter');
const logger = require('../../logger');

const slashCommands = new Map([
  [botCommand.data.name, botCommand],
  [rankCommand.data.name, rankCommand],
  [rankResetCommand.data.name, rankResetCommand],
  [submitCommand.data.name, submitCommand],
  [tagsCommand.data.name, tagsCommand],
  [galleryCommand.data.name, galleryCommand],
  [configCommand.data.name, configCommand],
  [dashboardCommand.data.name, dashboardCommand],
  [leaderboardCommand.data.name, leaderboardCommand],
  [profileCommand.data.name, profileCommand],
  [ticketCommand.data.name, ticketCommand],
  [ticketManageCommand.data.name, ticketManageCommand],
  [eventCommand.data.name, eventCommand],
  [spotlightCommand.data.name, spotlightCommand],
  [spotlightManageCommand.data.name, spotlightManageCommand]
]);

async function replyInteractionError(interaction) {
  const content = 'Something went wrong while handling that interaction.';

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content }).catch(() => null);
    return;
  }

  await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
}

async function handleInteractionCreate(interaction) {
  try {
    const roleHandled = await handleRoleInteraction(interaction);
    if (roleHandled) return;

    if (interaction.isButton()) {
      const eventHandled = await eventService.handleRsvp(interaction);
      if (eventHandled) return;

      const attendanceHandled = await eventService.handleAttendance(interaction);
      if (attendanceHandled) return;

      const spotlightHandled = await spotlightService.handleVote(interaction);
      if (spotlightHandled) return;
    }

    const flowHandled = await interactionFlowRouter.handleInteraction(interaction);
    if (flowHandled) return;

    if (interaction.customId && galleryWizardService.isWizardInteraction(interaction)) {
      const handled = await galleryWizardService.handleInteraction(interaction);
      if (handled) return;
    }

    if (interaction.isAutocomplete()) {
      const command = slashCommands.get(interaction.commandName);
      if (!command || typeof command.autocomplete !== 'function') {
        await interaction.respond([]).catch(() => null);
        return;
      }

      await command.autocomplete(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = slashCommands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({
        content: 'That command is no longer active. Refresh Discord or wait a moment and try again.',
        flags: MessageFlags.Ephemeral
      }).catch(() => null);
      return;
    }

    await command.execute(interaction);
  } catch (error) {
    logger.error('Interaction handler failed', error);
    await replyInteractionError(interaction);
  }
}

module.exports = {
  handleInteractionCreate
};
