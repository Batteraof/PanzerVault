const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
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
      .setDescription('Community bot for rules verification, onboarding roles, leveling, guided gallery submissions, video posts, events, spotlight voting, tickets, and weekly community touches.')
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: 'What I Can Do',
          value: 'Welcome new members\nHandle rules verification and onboarding roles\nTrack text and voice XP\nGuide gallery submissions with a draft wizard\nPost YouTube video links in a dedicated channel\nRun event RSVP posts and reminders\nManage monthly Community Spotlight nominations and voting\nManage support tickets\nPost weekly recaps and server anniversaries',
          inline: false
        },
        {
          name: 'Public Commands',
          value: '`/bot`\n`/rank`\n`/leaderboard`\n`/profile`\n`/submit`\n`/tags`\n`/video`\n`/spotlight`\n`/ticket`',
          inline: true
        },
        {
          name: 'Staff Commands',
          value: '`/config`\n`/gallery`\n`/event`\n`/rank-reset`\n`/spotlight-manage`\n`/ticket-manage`',
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

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
