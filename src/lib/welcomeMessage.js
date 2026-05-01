const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const customIds = require('./customIds');

function buildWelcomePayload(member, options = {}) {
  const guild = member.guild;
  const guildName = options.guildName || guild.name;
  const memberCount = options.memberCount || guild.memberCount;
  const avatarUrl = options.avatarUrl || member.user.displayAvatarURL({ dynamic: true, size: 256 });
  const mention = options.mention || `${member}`;
  const roleChannelId = options.roleChannelId || process.env.ROLE_PANEL_CHANNEL_ID || null;
  const siteLine = options.siteLine || 'Server information, useful tools, links, and event details are waiting there.';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`Welcome to ${guildName}`)
    .setDescription([
      `Welcome ${mention}. Glad to have you with us.`,
      '',
      'Settle in, take a look around, and have a good time with the community.'
    ].join('\n'))
    .setThumbnail(avatarUrl)
    .setImage('https://i.imgur.com/jNjayEQ.png')
    .addFields(
      { name: 'Members', value: `${memberCount}`, inline: true },
      { name: 'Start Here', value: siteLine, inline: false },
      {
        name: 'Roles',
        value: roleChannelId ? `Visit <#${roleChannelId}> to update roles and choose the pings you want.` : 'Visit the roles channel to update roles and choose the pings you want.',
        inline: false
      },
      { name: 'Say Hello', value: 'Introduce yourself when you are ready so the server can welcome you properly.', inline: false }
    )
    .setFooter({ text: 'Enjoy your stay in PanzerVault.' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Visit Site')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(customIds.SITE_INFO),
      new ButtonBuilder()
        .setLabel('Introduce Yourself')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`${customIds.INTRODUCE_SELF}:${guild.id}`)
    );

  return {
    embeds: [embed],
    components: [row]
  };
}

module.exports = {
  buildWelcomePayload
};
