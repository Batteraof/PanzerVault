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

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`Welcome to ${guildName}`)
    .setDescription(`Hey ${mention}, glad you made it in. Discord already handled the basics, so the next step is just getting settled and saying hello when you feel like it.`)
    .setThumbnail(avatarUrl)
    .setImage('https://i.imgur.com/jNjayEQ.png')
    .addFields(
      { name: 'Members', value: `${memberCount}`, inline: true },
      { name: 'Site', value: 'Server overview, links, events, and community info live there.', inline: false },
      { name: 'General', value: 'Introduce yourself if you want. Members can wave back to welcome you.', inline: false }
    )
    .setFooter({ text: 'Enjoy your stay.' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Tell us about yourself')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(customIds.INTRODUCE_SELF),
      new ButtonBuilder()
        .setLabel('Visit the site')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(customIds.SITE_INFO),
      new ButtonBuilder()
        .setLabel('Choose team')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(customIds.TEAM_MENU)
    );

  return {
    embeds: [embed],
    components: [row]
  };
}

module.exports = {
  buildWelcomePayload
};
