const { ActionRowBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
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

function isRoleButton(customId) {
  return [
    customIds.JOIN_INFO,
    customIds.ROLES_MENU,
    customIds.AGREE_RULES,
    customIds.COACH_TOGGLE
  ].includes(customId);
}

function isRoleSelect(customId) {
  return [
    customIds.SKILL_SELECT,
    customIds.REGION_SELECT,
    customIds.ROLE_SELECT
  ].includes(customId);
}

async function respondEphemeral(interaction, payload) {
  const response = typeof payload === 'string' ? { content: payload } : payload;
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  }

  return interaction.reply({
    ...response,
    flags: MessageFlags.Ephemeral
  });
}

async function assignRoleFromGroup(interaction, groupKey, selectedValue) {
  const member = interaction.member;
  const botMember = interaction.guild.members.me;
  const roles = await onboardingRoleService.listRolesByGroup(interaction.guild.id, groupKey);
  const selected = roles.find(role => role.option_key === selectedValue);

  if (!selected) {
    await respondEphemeral(interaction, 'That role option is no longer available.');
    return true;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await respondEphemeral(interaction, 'I do not have permission to manage roles.');
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
    await respondEphemeral(interaction, 'The selected role no longer exists.');
    return true;
  }

  if (botMember.roles.highest.comparePositionTo(selectedRole) <= 0) {
    await respondEphemeral(interaction, 'My role is too low to assign that role.');
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

  await respondEphemeral(interaction, followUp);

  return true;
}

async function handleCoachToggle(interaction) {
  const communitySettings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
  const coachRoleId = communitySettings.coach_role_id;
  if (!coachRoleId) {
    await respondEphemeral(interaction, 'Coach mode is not configured yet.');
    return true;
  }

  const skillRoles = await onboardingRoleService.listRolesByGroup(interaction.guild.id, 'skill');
  const selectedSkill = skillRoles.find(role => interaction.member.roles.cache.has(role.role_id));

  if (!selectedSkill || !isCoachEligible(selectedSkill.option_key)) {
    await respondEphemeral(interaction, 'Only members with the Medium or Expert role can opt into the coach role.');
    return true;
  }

  const coachRole = interaction.guild.roles.cache.get(coachRoleId);
  const botMember = interaction.guild.members.me;
  if (!coachRole) {
    await respondEphemeral(interaction, 'The coach role no longer exists.');
    return true;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await respondEphemeral(interaction, 'I do not have permission to manage roles.');
    return true;
  }

  if (botMember.roles.highest.comparePositionTo(coachRole) <= 0) {
    await respondEphemeral(interaction, 'My role is too low to manage the coach role.');
    return true;
  }

  if (interaction.member.roles.cache.has(coachRole.id)) {
    await interaction.member.roles.remove(coachRole);
    await respondEphemeral(interaction, `Coach mode disabled. You no longer have ${coachRole}.`);
    return true;
  }

  await interaction.member.roles.add(coachRole);
  await respondEphemeral(interaction, `Coach mode enabled. You now have ${coachRole} so beginners know they can ask you for help.`);
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

    return respondEphemeral(interaction, {
      content:
        `Welcome. Check the rules, get settled in, and if you are ready to play head to <#${config.channels.gameChannelId}> and use <@&${config.channels.readyRoleId}>.${rulesLine}`
    });
  }

  if (interaction.customId === customIds.ROLES_MENU) {
    const data = await buildRolePanelData(interaction.guild.id);
    const components = await buildRolePanelComponents(interaction.guild.id);

    return respondEphemeral(interaction, {
      content: `**Select your onboarding roles below:**\n${buildRolePanelContent(data)}`,
      components
    });
  }

  if (interaction.customId === customIds.AGREE_RULES) {
    const settings = await botSettingsService.ensureGuildSettings(interaction.guild.id);
    const member = interaction.member;
    const botMember = interaction.guild.members.me;

    if (!settings.rules_enabled || !settings.rules_verified_role_id) {
      return respondEphemeral(interaction, 'Rules verification is not configured yet. Please contact staff.');
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return respondEphemeral(interaction, 'I do not have permission to grant the verified role.');
    }

    const verifiedRole = interaction.guild.roles.cache.get(settings.rules_verified_role_id);
    if (!verifiedRole) {
      return respondEphemeral(interaction, 'The verified role is missing. Please contact staff.');
    }

    if (botMember.roles.highest.comparePositionTo(verifiedRole) <= 0) {
      return respondEphemeral(interaction, 'My role is too low to grant the verified role.');
    }

    if (!member.roles.cache.has(verifiedRole.id)) {
      await member.roles.add(verifiedRole);
    }

    const data = await buildRolePanelData(interaction.guild.id);
    const components = await buildRolePanelComponents(interaction.guild.id);
    return respondEphemeral(interaction, {
      content: `Thanks for agreeing to the rules. You now have access to the full server.\n\n**Select your onboarding roles below:**\n${buildRolePanelContent(data)}`,
      components
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
    if (!isRoleButton(interaction.customId)) return false;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const handled = await handleRoleButton(interaction);
    return Boolean(handled);
  }

  if (interaction.isStringSelectMenu()) {
    if (!isRoleSelect(interaction.customId)) return false;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return handleRoleSelect(interaction);
  }

  return false;
}

module.exports = {
  handleRoleInteraction
};
