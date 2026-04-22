const rankCommand = require('../../commands/rank');
const galleryCommand = require('../../commands/gallery');
const configCommand = require('../../commands/config');
const leaderboardCommand = require('../../commands/leaderboard');
const profileCommand = require('../../commands/profile');
const ticketCommand = require('../../commands/ticket');
const { handleRoleInteraction } = require('./roleInteractions');
const logger = require('../../logger');

const slashCommands = new Map([
  [rankCommand.data.name, rankCommand],
  [galleryCommand.data.name, galleryCommand],
  [configCommand.data.name, configCommand],
  [leaderboardCommand.data.name, leaderboardCommand],
  [profileCommand.data.name, profileCommand],
  [ticketCommand.data.name, ticketCommand]
]);

async function replyInteractionError(interaction) {
  const content = 'Something went wrong while handling that interaction.';

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content }).catch(() => null);
    return;
  }

  await interaction.reply({ content, ephemeral: true }).catch(() => null);
}

async function handleInteractionCreate(interaction) {
  try {
    const roleHandled = await handleRoleInteraction(interaction);
    if (roleHandled) return;

    if (!interaction.isChatInputCommand()) return;

    const command = slashCommands.get(interaction.commandName);
    if (!command) return;

    await command.execute(interaction);
  } catch (error) {
    logger.error('Interaction handler failed', error);
    await replyInteractionError(interaction);
  }
}

module.exports = {
  handleInteractionCreate
};
