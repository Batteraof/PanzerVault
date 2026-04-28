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
          value: 'Welcome new members and invite optional introductions\nLet members update their skill role with `/role`\nLet members choose a team role with `/team`\nOffer the helper role to Medium and Expert members\nTrack text and voice XP\nGuide gallery and video submissions with a unified draft wizard\nRun event RSVP posts and reminders\nManage monthly Community Spotlight nominations and voting\nManage support tickets\nPost weekly recaps and server anniversaries\nPoint members to the server site',
          inline: false
        },
        {
          name: 'Public Commands',
          value: '`/bot`\n`/role`\n`/team`\n`/rank`\n`/leaderboard`\n`/profile`\n`/submit`\n`/tags`\n`/spotlight`\n`/ticket`',
          inline: true
        },
        {
          name: 'Staff Commands',
          value: '`/dashboard`\n`/config`\n`/gallery`\n`/event`\n`/rank-reset`\n`/spotlight-manage`\n`/ticket-manage`',
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
