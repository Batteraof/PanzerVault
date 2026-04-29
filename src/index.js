const {
  Client,
  Events,
  GatewayIntentBits,
  Partials
} = require('discord.js');
const config = require('./config');
const db = require('./db/client');
const logger = require('./logger');
const { handleReady } = require('./events/ready');
const { handleGuildMemberAdd, handleGuildMemberUpdate } = require('./events/guild/memberAdd');
const { handleInteractionCreate } = require('./events/interaction');
const { handleMessageCreate } = require('./events/message');
const { handleMessageDelete } = require('./events/message/delete');
const { handleMessageReactionAdd, handleMessageReactionRemove } = require('./events/reaction');
const { handleVoiceStateUpdate } = require('./events/voice');
const voiceTrackingService = require('./modules/leveling/services/voiceTrackingService');
const communitySchedulerService = require('./modules/community/services/communitySchedulerService');

config.validateConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

client.once(Events.ClientReady, () => {
  handleReady(client).catch(error => {
    logger.error('Ready handler failed', error);
  });
});

client.on('guildMemberAdd', member => {
  handleGuildMemberAdd(member).catch(error => {
    logger.warn('guildMemberAdd handler failed', error);
  });
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  handleGuildMemberUpdate(oldMember, newMember).catch(error => {
    logger.warn('guildMemberUpdate helper prompt failed', error);
  });
});

client.on('interactionCreate', interaction => {
  handleInteractionCreate(interaction).catch(error => {
    logger.warn('interactionCreate handler failed', error);
  });
});

client.on('messageCreate', message => {
  handleMessageCreate(message).catch(error => {
    logger.warn('messageCreate handler failed', error);
  });
});

client.on('messageDelete', message => {
  handleMessageDelete(message).catch(error => {
    logger.warn('messageDelete handler failed', error);
  });
});

client.on('messageReactionAdd', (reaction, user) => {
  handleMessageReactionAdd(reaction, user).catch(error => {
    logger.warn('messageReactionAdd handler failed', error);
  });
});

client.on('messageReactionRemove', (reaction, user) => {
  handleMessageReactionRemove(reaction, user).catch(error => {
    logger.warn('messageReactionRemove handler failed', error);
  });
});

client.on('voiceStateUpdate', (oldState, newState) => {
  handleVoiceStateUpdate(oldState, newState).catch(error => {
    logger.warn('voiceStateUpdate handler failed', error);
  });
});

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down`);
  communitySchedulerService.stop();
  voiceTrackingService.stop();
  client.destroy();
  await db.close();
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(error => {
    logger.error('Shutdown failed', error);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(error => {
    logger.error('Shutdown failed', error);
    process.exit(1);
  });
});

client.login(process.env.TOKEN);
