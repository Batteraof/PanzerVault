const { EmbedBuilder } = require('discord.js');
const guildSettingsRepository = require('../../../db/repositories/guildSettingsRepository');
const logger = require('../../../logger');

async function handleLevelUp(client, awardResult) {
  if (!awardResult || !awardResult.leveledUp) return;

  const settings = awardResult.settings || await guildSettingsRepository.getSettings(awardResult.guildId);
  if (!settings) return;

  const mention = `<@${awardResult.userId}>`;
  const nextLevel = Number(awardResult.newLevel || 0) + 1;

  if (settings.levelup_channel_id) {
    try {
      const channel = await client.channels.fetch(settings.levelup_channel_id);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('Promotion Earned')
          .setDescription(`${mention} just reached **Level ${awardResult.newLevel}**.`)
          .addFields(
            {
              name: 'New Rank',
              value: `Level ${awardResult.newLevel}`,
              inline: true
            },
            {
              name: 'Next Objective',
              value: `Level ${nextLevel}`,
              inline: true
            },
            {
              name: 'Nice Work',
              value: 'Keep showing up, helping the squad, and staying active in PanzerVault.',
              inline: false
            }
          )
          .setFooter({ text: 'PanzerVault progression' })
          .setTimestamp();

        await channel.send({
          content: `${mention} leveled up.`,
          embeds: [embed],
          allowedMentions: { users: [awardResult.userId], roles: [] }
        });
      }
    } catch (error) {
      logger.warn('Failed to send level-up channel announcement', error);
    }
  }

  if (settings.dm_levelup_enabled) {
    try {
      const user = await client.users.fetch(awardResult.userId);
      await user.send(`Promotion earned. You reached level ${awardResult.newLevel} in PanzerVault. Nice work.`);
    } catch (error) {
      logger.debug('Failed to send level-up DM', error);
    }
  }
}

module.exports = {
  handleLevelUp
};
