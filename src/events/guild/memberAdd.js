const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const config = require('../../config');
const customIds = require('../../lib/customIds');
const botSettingsService = require('../../modules/config/services/botSettingsService');
const logger = require('../../logger');

async function handleGuildMemberAdd(member) {
  const settings = await botSettingsService.ensureGuildSettings(member.guild.id);
  if (!settings.welcome_enabled) return;

  const welcomeChannelId = settings.welcome_channel_id || config.channels.welcome;
  const channel = member.guild.channels.cache.get(welcomeChannelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('👋 Welcome to the Server! Check info to learn how to use our discord')
    .setDescription(`Hey ${member}, welcome to **${member.guild.name}**! 🎉`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setImage('https://i.imgur.com/jNjayEQ.png')
    .addFields(
      { name: '👥 Members', value: `${member.guild.memberCount}`, inline: true },
      { name: '🌐 Site', value: 'Check our site', inline: true },
      { name: '💬 General', value: 'Say hi in general!', inline: true }
    )
    .setFooter({ text: 'Enjoy your stay!' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('✨ Join Info')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(customIds.JOIN_INFO),
      new ButtonBuilder()
        .setLabel('🌐 site')
        .setStyle(ButtonStyle.Link)
        .setURL(config.channels.siteUrl),
      new ButtonBuilder()
        .setLabel('💬 General')
        .setStyle(ButtonStyle.Link)
        .setURL(config.channels.generalUrl),
      new ButtonBuilder()
        .setLabel('🎭 Select Roles')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(customIds.ROLES_MENU)
    );

  try {
    await channel.send({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    logger.warn('Failed to send welcome message', error);
  }
}

module.exports = {
  handleGuildMemberAdd
};
