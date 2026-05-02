const { EmbedBuilder, MessageFlags, SlashCommandBuilder } = require('discord.js');
const config = require('../config');
const packageJson = require('../../package.json');
const { supportLine } = require('../modules/config/services/serverPanelService');

function supportValue() {
  const lines = [];

  if (config.botInfo.ownerName) {
    lines.push(`Made by ${config.botInfo.ownerName}.`);
  }

  lines.push(supportLine());
  return lines.join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Show what this bot does and how to get help.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${interaction.client.user.username}`)
      .setDescription('Community bot for welcome introductions, leveling, helper opt-ins, guided media submissions, events, spotlight voting, tickets, and weekly community touches.')
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: 'What I Can Do',
          value: 'Welcome new members and invite optional introductions\nLet members update roles from the roles channel\nOffer the helper role to Medium and Expert members\nTrack text and voice XP\nGuide optional media submissions for showcase and promo use\nRun event RSVP posts and reminders\nManage monthly Community Spotlight nominations and voting\nManage support tickets\nPost weekly recaps and server anniversaries\nPoint members to the server site',
          inline: false
        },
        {
          name: 'Public Commands',
          value: '`/bot`\n`/rank`\n`/leaderboard`\n`/submit`\n`/spotlight`\n`/ticket`\n\nRole commands are only for the roles channel.',
          inline: true
        },
        {
          name: 'Support',
          value: supportValue(),
          inline: false
        }
      )
      .setFooter({ text: `Version ${packageJson.version}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
