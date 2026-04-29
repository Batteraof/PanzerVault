const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { buildRoleCategoryPicker } = require('../lib/roleCategoryPicker');
const botSettingsService = require('../modules/config/services/botSettingsService');
const roleCategoryService = require('../modules/config/services/roleCategoryService');

async function assertRolesChannel(interaction) {
  const settings = await botSettingsService.ensureGuildSettings(interaction.guild.id);
  const roleChannelId = settings.role_panel_channel_id;
  if (roleChannelId && interaction.channelId !== roleChannelId) {
    await interaction.reply({
      content: `Use this in <#${roleChannelId}> so role changes stay in the roles channel.`,
      flags: MessageFlags.Ephemeral
    });
    return false;
  }
  return true;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Choose or update your team role.'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!(await assertRolesChannel(interaction))) return;

    const category = await roleCategoryService.findByCommandName(interaction.guild.id, 'team');
    await interaction.reply({
      ...await buildRoleCategoryPicker(interaction.guild.id, category),
      flags: MessageFlags.Ephemeral
    });
  }
};
