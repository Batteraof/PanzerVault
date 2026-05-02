require('dotenv').config();

const { REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('../logger');
const botCommand = require('./bot');
const roleCategoryCommand = require('./roleCategoryCommand');
const rankCommand = require('./rank');
const rankResetCommand = require('./rankReset');
const galleryCommand = require('./gallery');
const submitCommand = require('./submit');
const configCommand = require('./config');
const dashboardCommand = require('./dashboard');
const leaderboardCommand = require('./leaderboard');
const ticketCommand = require('./ticket');
const ticketManageCommand = require('./ticketManage');
const eventCommand = require('./event');
const spotlightCommand = require('./spotlight');
const spotlightManageCommand = require('./spotlightManage');

async function registerCommands() {
  if (!config.discord.clientId) {
    throw new Error('CLIENT_ID is required to register slash commands');
  }

  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const dynamicCategoryCommands = config.discord.guildId
    ? await roleCategoryCommand.buildDynamicCategoryCommands(config.discord.guildId)
    : [];
  const commands = [
    botCommand.data.toJSON(),
    rankCommand.data.toJSON(),
    rankResetCommand.data.toJSON(),
    submitCommand.data.toJSON(),
    galleryCommand.data.toJSON(),
    configCommand.data.toJSON(),
    dashboardCommand.data.toJSON(),
    leaderboardCommand.data.toJSON(),
    ticketCommand.data.toJSON(),
    ticketManageCommand.data.toJSON(),
    eventCommand.data.toJSON(),
    spotlightCommand.data.toJSON(),
    spotlightManageCommand.data.toJSON(),
    ...dynamicCategoryCommands.map(command => command.toJSON())
  ];

  if (config.discord.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands }
    );

    await rest.put(Routes.applicationCommands(config.discord.clientId), { body: [] });
    logger.info('Cleared global slash commands to avoid stale command entries');
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
