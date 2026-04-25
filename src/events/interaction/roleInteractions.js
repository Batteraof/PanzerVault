const { ActionRowBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../config');
const customIds = require('../../lib/customIds');
const {
  buildRolePanelComponents,
  buildRolePanelContent,
  buildRolePanelData
} = require('../../lib/rolePanel');
const botSettingsService = require('../../modules/config/services/botSettingsService');
const communitySettingsService = require('../../modules/config/services/communitySettingsService');
const onboardingRoleService = require('../../modules/config/services/onboardingRoleService');
const logger = require('../../logger');

function isCoachEligible(skillOptionKey) {
  return ['medium', 'expert'].includes(skillOptionKey);
}

async function assignRoleFromGroup(interaction, groupKey, selectedValue) {
  const member = interaction.member;
  const botMember = interaction.guild.members.me;
  const roles = await onboardingRoleService.listRolesByGroup(interaction.guild.id, groupKey);
  const selected = roles.find(role => role.option_key === selectedValue);

  if (!selected) {
    await interaction.reply({
      content: 'That role option is no longer available.',
      ephemeral: true
    });
    return true;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await interaction.reply({
      content: 'I do not have permission to manage roles.',
      ephemeral: true
    });
    return true;
  }

  const guildRoles = roles
    .map(role => interaction.guild.roles.cache.get(role.role_id))
    .filter(Boolean);

  for (const role of guildRoles) {
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role).catch(error => {
        logger.warn('Failed to remove onboarding role', error);
      });
    }
  }

  const selectedRole = interaction.guild.roles.cache.get(selected.role_id);
  if (!selectedRole) {
    await interaction.reply({
      content: 'The selected role no longer exists.',
      ephemeral: true
    });
    return true;
  }

  if (botMember.roles.highest.comparePositionTo(selectedRole) <= 0) {
    await interaction.reply({
      content: 'My role is too low to assign that role.',
      ephemeral: true
    });
    return true;
  }

  await member.roles.add(selectedRole);

  const communitySettings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
  let followUp = `Done. You now have ${selectedRole}.`;

  if (groupKey === 'skill' && selected.option_key === 'beginner' && communitySettings.coach_role_id) {
    followUp += `\nIf you need help getting started, watch for members with <@&${communitySettings.coach_role_id}>. They opted in as coaches.`;
  }

  if (groupKey === 'skill' && isCoachEligible(selected.option_key) && communitySettings.coach_role_id) {
    followUp += `\nYou can also tap **Toggle Coach Role** if you want beginners to know you are available to help.`;
  }

  await interaction.reply({
    content: followUp,
    ephemeral: true
  });

  return true;
}

async function handleCoachToggle(interaction) {
  const communitySettings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
  const coachRoleId = communitySettings.coach_role_id;
  if (!coachRoleId) {
    await interaction.reply({
      content: 'Coach mode is not configured yet.',
      ephemeral: true
    });
    return true;
  }

  const skillRoles = await onboardingRoleService.listRolesByGroup(interaction.guild.id, 'skill');
  const selectedSkill = skillRoles.find(role => interaction.member.roles.cache.has(role.role_id));

  if (!selectedSkill || !isCoachEligible(selectedSkill.option_key)) {
    await interaction.reply({
      content: 'Only members with the Medium or Expert role can opt into the coach role.',
      ephemeral: true
    });
    return true;
  }

  const coachRole = interaction.guild.roles.cache.get(coachRoleId);
  const botMember = interaction.guild.members.me;
  if (!coachRole) {
    await interaction.reply({
      content: 'The coach role no longer exists.',
      ephemeral: true
    });
    return true;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await interaction.reply({
      content: 'I do not have permission to manage roles.',
      ephemeral: true
    });
    return true;
  }

  if (botMember.roles.highest.comparePositionTo(coachRole) <= 0) {
    await interaction.reply({
      content: 'My role is too low to manage the coach role.',
      ephemeral: true
    });
    return true;
  }

  if (interaction.member.roles.cache.has(coachRole.id)) {
    await interaction.member.roles.remove(coachRole);
    await interaction.reply({
      content: `Coach mode disabled. You no longer have ${coachRole}.`,
      ephemeral: true
    });
    return true;
  }

  await interaction.member.roles.add(coachRole);
  await interaction.reply({
    content: `Coach mode enabled. You now have ${coachRole} so beginners know they can ask you for help.`,
    ephemeral: true
  });
  return true;
}

async function handleRoleButton(interaction) {
  if (interaction.customId === customIds.JOIN_INFO) {
    const settings = interaction.guild
      ? await botSettingsService.ensureGuildSettings(interaction.guild.id)
      : null;

    const rulesLine = settings && settings.rules_enabled && settings.rules_channel_id
      ? `\n\nBefore anything else, please read and accept the rules in <#${settings.rules_channel_id}> to unlock the rest of the server.`
      : '';

    return interaction.reply({
      content:
        `Welcome. Check the rules, get settled in, and if you are ready to play head to <#${config.channels.gameChannelId}> and use <@&${config.channels.readyRoleId}>.${rulesLine}`,
      ephemeral: true
    });
  }

  if (interaction.customId === customIds.ROLES_MENU) {
    const data = await buildRolePanelData(interaction.guild.id);
    const components = await buildRolePanelComponents(interaction.guild.id);

    return interaction.reply({
      content: `**Select your onboarding roles below:**\n${buildRolePanelContent(data)}`,
      components,
      ephemeral: true
    });
  }

  if (interaction.customId === customIds.AGREE_RULES) {
    const settings = await botSettingsService.ensureGuildSettings(interaction.guild.id);
    const member = interaction.member;
    const botMember = interaction.guild.members.me;

    if (!settings.rules_enabled || !settings.rules_verified_role_id) {
      return interaction.reply({
        content: 'Rules verification is not configured yet. Please contact staff.',
        ephemeral: true
      });
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({
        content: 'I do not have permission to grant the verified role.',
        ephemeral: true
      });
    }

    const verifiedRole = interaction.guild.roles.cache.get(settings.rules_verified_role_id);
    if (!verifiedRole) {
      return interaction.reply({
        content: 'The verified role is missing. Please contact staff.',
        ephemeral: true
      });
    }

    if (botMember.roles.highest.comparePositionTo(verifiedRole) <= 0) {
      return interaction.reply({
        content: 'My role is too low to grant the verified role.',
        ephemeral: true
      });
    }

    if (!member.roles.cache.has(verifiedRole.id)) {
      await member.roles.add(verifiedRole);
    }

    const data = await buildRolePanelData(interaction.guild.id);
    const components = await buildRolePanelComponents(interaction.guild.id);
    return interaction.reply({
      content: `Thanks for agreeing to the rules. You now have access to the full server.\n\n**Select your onboarding roles below:**\n${buildRolePanelContent(data)}`,
      components,
      ephemeral: true
    });
  }

  if (interaction.customId === customIds.COACH_TOGGLE) {
    return handleCoachToggle(interaction);
  }

  return null;
}

async function handleRoleSelect(interaction) {
  if (interaction.customId === customIds.SKILL_SELECT) {
    return assignRoleFromGroup(interaction, 'skill', interaction.values[0]);
  }

  if (interaction.customId === customIds.REGION_SELECT) {
    return assignRoleFromGroup(interaction, 'region', interaction.values[0]);
  }

  if (interaction.customId === customIds.ROLE_SELECT) {
    return assignRoleFromGroup(interaction, 'skill', interaction.values[0].replace('role_', ''));
  }

  return false;
}

async function handleRoleInteraction(interaction) {
  if (interaction.isButton()) {
    const handled = await handleRoleButton(interaction);
    return Boolean(handled);
  }

  if (interaction.isStringSelectMenu()) {
    return handleRoleSelect(interaction);
  }

  return false;
}

module.exports = {
  handleRoleInteraction
};
