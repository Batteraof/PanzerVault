const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { buildRoleCategoryPicker } = require('../lib/roleCategoryPicker');
const botSettingsService = require('../modules/config/services/botSettingsService');
const roleCategoryService = require('../modules/config/services/roleCategoryService');

function buildCategoryCommand(category) {
  return new SlashCommandBuilder()
    .setName(category.command_name)
    .setDescription((category.description || `Choose ${category.label}.`).slice(0, 100));
}

async function buildDynamicCategoryCommands(guildId) {
  const categories = await roleCategoryService.listCategories(guildId);
  return categories
    .filter(category => !['skill', 'team'].includes(category.command_name))
    .map(buildCategoryCommand);
}

async function execute(interaction, category = null) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const settings = await botSettingsService.ensureGuildSettings(interaction.guild.id);
  const roleChannelId = settings.role_panel_channel_id;
  if (roleChannelId && interaction.channelId !== roleChannelId) {
    await interaction.reply({
      content: `Use this in <#${roleChannelId}> so role changes stay in the roles channel.`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const resolved = category || await roleCategoryService.findByCommandName(interaction.guild.id, interaction.commandName);
  if (!resolved) {
    await interaction.reply({ content: 'That role category is not configured right now.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({
    ...await buildRoleCategoryPicker(interaction.guild.id, resolved),
    flags: MessageFlags.Ephemeral
  });
}

module.exports = {
  buildDynamicCategoryCommands,
  execute
};
