const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Admin shortcut to open the bot dashboard.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Dashboard access can only be requested in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need Manage Server permission to open the dashboard.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!config.dashboard.url) {
      await interaction.reply({
        content: 'The dashboard URL is not configured yet. Set DASHBOARD_URL in the bot environment.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Open Dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(config.dashboard.url)
    );

    await interaction.reply({
      content: 'Open the admin dashboard here:',
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  }
};
