const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder
} = require('discord.js');
const customIds = require('../lib/customIds');
const onboardingRoleService = require('../modules/config/services/onboardingRoleService');
const memberSkillRoleService = require('../modules/config/services/memberSkillRoleService');
const communitySettingsService = require('../modules/config/services/communitySettingsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Update your skill role.')
    .addStringOption(option =>
      option
        .setName('skill')
        .setDescription('Choose your current skill level.')
        .setRequired(true)
        .addChoices(
          ...onboardingRoleService.SKILL_OPTIONS.map(skill => ({
            name: skill.label,
            value: skill.key
          }))
        )
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const skill = interaction.options.getString('skill', true);
    const result = await memberSkillRoleService.setMemberSkillRole(interaction.member, skill);

    if (!result.ok) {
      await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
      return;
    }

    const communitySettings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
    const showHelperButton = memberSkillRoleService.isHelperEligibleSkill(result.skill.option_key) && communitySettings.coach_role_id;
    const helperLine = showHelperButton
      ? '\nYou can opt into the helper role if you want Beginners to know they can ask you for help.'
      : '';
    const components = showHelperButton
      ? [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(customIds.COACH_TOGGLE)
              .setLabel('I can help beginners')
              .setStyle(ButtonStyle.Primary)
          )
        ]
      : [];

    await interaction.reply({
      content: `Done. Your skill role is now ${result.role}.${helperLine}`,
      components,
      flags: MessageFlags.Ephemeral
    });
  }
};
