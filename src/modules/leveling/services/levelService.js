const { EmbedBuilder } = require('discord.js');
const guildSettingsRepository = require('../../../db/repositories/guildSettingsRepository');
const logger = require('../../../logger');

async function handleLevelUp(client, awardResult) {
  if (!awardResult || !awardResult.leveledUp) return;

  const settings = awardResult.settings || await guildSettingsRepository.getSettings(awardResult.guildId);
  if (!settings) return;

  const message = `Level up! <@${awardResult.userId}> reached level ${awardResult.newLevel}.`;

  if (settings.levelup_channel_id) {
    try {
      const channel = await client.channels.fetch(settings.levelup_channel_id);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('Level Up')
          .setDescription(message)
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      logger.warn('Failed to send level-up channel announcement', error);
    }
  }

  if (settings.dm_levelup_enabled) {
    try {
      const user = await client.users.fetch(awardResult.userId);
      await user.send(`You reached level ${awardResult.newLevel} in your server. Nice work.`);
    } catch (error) {
      logger.debug('Failed to send level-up DM', error);
    }
  }
}

module.exports = {
  handleLevelUp
};
