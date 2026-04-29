const {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const config = require('../../config');
const customIds = require('../../lib/customIds');
const {
  buildRolePanelComponents,
  buildRolePanelContent,
  buildRolePanelData
} = require('../../lib/rolePanel');
const communitySettingsService = require('../../modules/config/services/communitySettingsService');
const onboardingRoleService = require('../../modules/config/services/onboardingRoleService');
const publicRoleService = require('../../modules/config/services/publicRoleService');
const memberTeamRoleService = require('../../modules/config/services/memberTeamRoleService');
const memberIntroductionRepository = require('../../db/repositories/memberIntroductionRepository');
const { buildTeamRolePicker } = require('../../lib/teamRolePicker');
const logger = require('../../logger');

function isCoachEligible(skillOptionKey) {
  return ['medium', 'expert'].includes(skillOptionKey);
}

function isRoleButton(customId) {
  return [
    customIds.JOIN_INFO,
    customIds.INTRODUCE_SELF,
    customIds.SITE_INFO,
    customIds.TEAM_MENU,
    customIds.ROLES_MENU,
    customIds.COACH_TOGGLE,
    customIds.PUBLIC_ROLE_CLEAR
  ].includes(customId);
}

function parseChannelIdFromUrl(url = '') {
  const match = String(url).match(/\/channels\/\d+\/(\d+)/);
  return match ? match[1] : null;
}

function getGeneralChannelId() {
  return config.channels.generalChannelId || parseChannelIdFromUrl(config.channels.generalUrl);
}

function isRoleSelect(customId) {
  return [
    customIds.SKILL_SELECT,
    customIds.REGION_SELECT,
    customIds.TEAM_SELECT,
    customIds.PUBLIC_ROLE_SELECT,
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
  const communitySettings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);

  if (communitySettings.onboarding_enabled === false) {
    await respondEphemeral(interaction, 'Discord Onboarding handles those roles now. Use Channels & Roles to update your platform, region, skill, or channel choices.');
    return true;
  }

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

  let followUp = `Done. You now have ${selectedRole}.`;

  if (groupKey === 'skill' && selected.option_key === 'beginner' && communitySettings.coach_role_id) {
    followUp += `\nIf you need help getting started, watch for members with <@&${communitySettings.coach_role_id}>. They opted in as coaches.`;
  }

  if (groupKey === 'skill' && isCoachEligible(selected.option_key) && communitySettings.coach_role_id) {
    followUp += `\nYou can also tap **Toggle Helper Role** if you want beginners to know you are available to help.`;
  }

  await respondEphemeral(interaction, followUp);

  return true;
}

async function handleCoachToggle(interaction) {
  const communitySettings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
  const coachRoleId = communitySettings.coach_role_id;
  if (!coachRoleId) {
    await respondEphemeral(interaction, 'The helper role is not configured yet.');
    return true;
  }

  const skillRoles = await onboardingRoleService.listRolesByGroup(interaction.guild.id, 'skill');
  const selectedSkill = skillRoles.find(role => interaction.member.roles.cache.has(role.role_id));

  if (!selectedSkill || !isCoachEligible(selectedSkill.option_key)) {
    await respondEphemeral(interaction, 'Only members with the Medium or Expert role can opt into the helper role.');
    return true;
  }

  const coachRole = interaction.guild.roles.cache.get(coachRoleId);
  const botMember = interaction.guild.members.me;
  if (!coachRole) {
    await respondEphemeral(interaction, 'The helper role no longer exists.');
    return true;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await respondEphemeral(interaction, 'I do not have permission to manage roles.');
    return true;
  }

  if (botMember.roles.highest.comparePositionTo(coachRole) <= 0) {
    await respondEphemeral(interaction, 'My role is too low to manage the helper role.');
    return true;
  }

  if (interaction.member.roles.cache.has(coachRole.id)) {
    await interaction.member.roles.remove(coachRole);
    await respondEphemeral(interaction, `Helper role disabled. You no longer have ${coachRole}.`);
    return true;
  }

  await interaction.member.roles.add(coachRole);
  await respondEphemeral(interaction, `Helper role enabled. You now have ${coachRole} so beginners know they can ask you for help.`);
  return true;
}

async function setPublicRoles(interaction, selectedValues) {
  const publicRoles = await publicRoleService.listPublicRoles(interaction.guild.id);
  const selectedKeys = new Set(selectedValues || []);
  const botMember = interaction.guild.members.me;

  if (publicRoles.length === 0) {
    await respondEphemeral(interaction, 'No community roles are configured yet.');
    return true;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await respondEphemeral(interaction, 'I do not have permission to manage roles.');
    return true;
  }

  const guildRoles = publicRoles
    .map(role => ({
      option: role,
      role: interaction.guild.roles.cache.get(role.role_id)
    }))
    .filter(item => item.role);

  const blockedRole = guildRoles.find(item => botMember.roles.highest.comparePositionTo(item.role) <= 0);
  if (blockedRole) {
    await respondEphemeral(interaction, `My role is too low to manage ${blockedRole.role}.`);
    return true;
  }

  const added = [];
  const removed = [];

  for (const item of guildRoles) {
    const shouldHaveRole = selectedKeys.has(item.option.option_key);
    const hasRole = interaction.member.roles.cache.has(item.role.id);

    if (shouldHaveRole && !hasRole) {
      await interaction.member.roles.add(item.role);
      added.push(item.role);
    }

    if (!shouldHaveRole && hasRole) {
      await interaction.member.roles.remove(item.role);
      removed.push(item.role);
    }
  }

  const lines = [];
  if (added.length > 0) lines.push(`Added: ${added.join(', ')}`);
  if (removed.length > 0) lines.push(`Removed: ${removed.join(', ')}`);
  if (lines.length === 0) lines.push('Your community roles are already up to date.');

  await respondEphemeral(interaction, lines.join('\n'));
  return true;
}

async function showIntroduceSelfModal(interaction) {
  const existing = await memberIntroductionRepository.getIntroduction(interaction.guild.id, interaction.user.id);
  if (existing) {
    await respondEphemeral(interaction, 'You have already posted your introduction. Staff can help if you need it changed.');
    return true;
  }

  const modal = new ModalBuilder()
    .setCustomId(customIds.INTRODUCE_SELF_MODAL)
    .setTitle('Tell us about yourself');

  const input = new TextInputBuilder()
    .setCustomId(customIds.INTRODUCE_SELF_INPUT)
    .setLabel('What should the community know about you?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(700)
    .setPlaceholder('Nickname, region, playstyle, favorite role, or anything you want to share.');

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
  return true;
}

async function handleIntroduceSelfSubmit(interaction) {
  const reserved = await memberIntroductionRepository.reserveIntroduction(interaction.guild.id, interaction.user.id);
  if (!reserved) {
    await respondEphemeral(interaction, 'You have already posted your introduction. Staff can help if you need it changed.');
    return true;
  }

  const generalChannelId = getGeneralChannelId();
  const channel = generalChannelId
    ? interaction.guild.channels.cache.get(generalChannelId) || await interaction.guild.channels.fetch(generalChannelId).catch(() => null)
    : null;

  if (!channel || !channel.isTextBased()) {
    await memberIntroductionRepository.releaseIntroduction(interaction.guild.id, interaction.user.id);
    await respondEphemeral(interaction, 'I could not find the general channel for introductions. Please tell staff.');
    return true;
  }

  const introduction = interaction.fields.getTextInputValue(customIds.INTRODUCE_SELF_INPUT).trim();
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('New Introduction')
    .setDescription(introduction)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: 'Wave back to welcome them.' })
    .setTimestamp();

  let message;
  try {
    message = await channel.send({
      content: `${interaction.user} told us a bit about themselves.`,
      embeds: [embed],
      allowedMentions: { users: [interaction.user.id], roles: [] }
    });
  } catch (error) {
    await memberIntroductionRepository.releaseIntroduction(interaction.guild.id, interaction.user.id);
    throw error;
  }

  await memberIntroductionRepository.markIntroductionPosted(
    interaction.guild.id,
    interaction.user.id,
    channel.id,
    message.id
  );

  await message.react('\u{1F44B}').catch(error => {
    logger.warn('Failed to add welcome wave reaction', error);
  });

  const picker = await buildTeamRolePicker(interaction.guild.id);
  const teamLine = picker.components.length > 0
    ? '\n\nYou can also choose a team now if you want.'
    : '';

  await respondEphemeral(interaction, {
    content: `Thanks. I posted your introduction in ${channel}.${teamLine}\n\n${picker.content}`,
    components: picker.components
  });
  return true;
}

async function handleRoleButton(interaction) {
  if (interaction.customId === customIds.JOIN_INFO) {
    return respondEphemeral(interaction, {
      content:
        `Welcome. Discord Onboarding handles the basics now. Visit the site for server info, introduce yourself if you want, and when you are ready to play head to <#${config.channels.gameChannelId}> and use <@&${config.channels.readyRoleId}>.`
    });
  }

  if (interaction.customId === customIds.ROLES_MENU) {
    const data = await buildRolePanelData(interaction.guild.id);
    const components = await buildRolePanelComponents(interaction.guild.id);
    const botOnboardingEnabled = data.communitySettings.onboarding_enabled !== false;
    const title = botOnboardingEnabled ? 'Select your onboarding roles below' : 'Role setup';

    return respondEphemeral(interaction, {
      content: `**${title}:**\n${buildRolePanelContent(data)}`,
      components
    });
  }

  if (interaction.customId === customIds.INTRODUCE_SELF) {
    return showIntroduceSelfModal(interaction);
  }

  if (interaction.customId === customIds.SITE_INFO) {
    return respondEphemeral(interaction, {
      content: `Visit the server site for community links, server info, and the quickest overview of what Tanks Let Loose is about:\n${config.channels.siteUrl}`
    });
  }

  if (interaction.customId === customIds.TEAM_MENU) {
    return respondEphemeral(interaction, await buildTeamRolePicker(interaction.guild.id));
  }

  if (interaction.customId === customIds.COACH_TOGGLE) {
    return handleCoachToggle(interaction);
  }

  if (interaction.customId === customIds.PUBLIC_ROLE_CLEAR) {
    return setPublicRoles(interaction, []);
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

  if (interaction.customId === customIds.TEAM_SELECT) {
    const result = await memberTeamRoleService.setMemberTeamRole(interaction.member, interaction.values[0]);
    await respondEphemeral(interaction, result.ok
      ? `Done. Your team role is now ${result.role}.`
      : result.message);
    return true;
  }

  if (interaction.customId === customIds.PUBLIC_ROLE_SELECT) {
    return setPublicRoles(interaction, interaction.values);
  }

  return false;
}

async function handleRoleInteraction(interaction) {
  if (interaction.isModalSubmit()) {
    if (interaction.customId !== customIds.INTRODUCE_SELF_MODAL) return false;
    return handleIntroduceSelfSubmit(interaction);
  }

  if (interaction.isButton()) {
    if (!isRoleButton(interaction.customId)) return false;
    if (interaction.customId === customIds.INTRODUCE_SELF) {
      return handleRoleButton(interaction);
    }
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
