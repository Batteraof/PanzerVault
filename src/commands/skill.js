const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder } = require('discord.js');
const customIds = require('../lib/customIds');
const { buildRoleCategoryPicker } = require('../lib/roleCategoryPicker');
const botSettingsService = require('../modules/config/services/botSettingsService');
const communitySettingsService = require('../modules/config/services/communitySettingsService');
const memberSkillRoleService = require('../modules/config/services/memberSkillRoleService');
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
    .setName('skill')
    .setDescription('Choose or update your skill role.'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!(await assertRolesChannel(interaction))) return;

    const category = await roleCategoryService.findByCommandName(interaction.guild.id, 'skill');
    const picker = await buildRoleCategoryPicker(interaction.guild.id, category);
    const communitySettings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
    const selectedSkill = await memberSkillRoleService.getMemberSkillRole(interaction.member);
    const showHelperButton = selectedSkill &&
      memberSkillRoleService.isHelperEligibleSkill(selectedSkill.option_key) &&
      communitySettings.coach_role_id;

    const components = [...picker.components];
    if (showHelperButton) {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(customIds.COACH_TOGGLE)
            .setLabel('I can help beginners')
            .setStyle(ButtonStyle.Primary)
        )
      );
    }

    await interaction.reply({
      content: picker.content,
      components,
      flags: MessageFlags.Ephemeral
    });
  }
};
