require('dotenv').config();

const { REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('../logger');
const rankCommand = require('./rank');
const galleryCommand = require('./gallery');
const configCommand = require('./config');
const leaderboardCommand = require('./leaderboard');
const profileCommand = require('./profile');
const ticketCommand = require('./ticket');

async function registerCommands() {
  if (!config.discord.clientId) {
    throw new Error('CLIENT_ID is required to register slash commands');
  }

  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const commands = [
    rankCommand.data.toJSON(),
    galleryCommand.data.toJSON(),
    configCommand.data.toJSON(),
    leaderboardCommand.data.toJSON(),
    profileCommand.data.toJSON(),
    ticketCommand.data.toJSON()
  ];

  if (config.discord.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands }
    );
    logger.info('Registered guild slash commands', config.discord.guildId);
    return;
  }

  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commands });
  logger.info('Registered global slash commands');
}

registerCommands().catch(error => {
  logger.error('Failed to register slash commands', error);
  process.exitCode = 1;
});
