const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const config = require('../../config');
const customIds = require('../../lib/customIds');
const botSettingsService = require('../../modules/config/services/botSettingsService');
const communitySettingsService = require('../../modules/config/services/communitySettingsService');
const memberSkillRoleService = require('../../modules/config/services/memberSkillRoleService');
const { buildWelcomePayload } = require('../../lib/welcomeMessage');
const logger = require('../../logger');

async function maybeSendHelperPrompt(member) {
  const communitySettings = await communitySettingsService.ensureGuildSettings(member.guild.id);
  if (!communitySettings.coach_role_id || member.roles.cache.has(communitySettings.coach_role_id)) return;

  const eligible = await memberSkillRoleService.memberHasHelperEligibleSkill(member);
  if (!eligible) return;

  await member.send({
    content: [
      `Because you joined ${member.guild.name} as Medium or Expert, you can opt into the helper role.`,
      'That lets Beginners know they can ask you for help.'
    ].join('\n'),
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${customIds.COACH_TOGGLE}:${member.guild.id}`)
          .setLabel('I can help beginners')
          .setStyle(ButtonStyle.Primary)
      )
    ]
  }).catch(error => {
    logger.warn('Failed to send helper prompt', error);
  });
}

async function maybeSendPrivateIntroductionPrompt(member) {
  await member.send({
    content: [
      `Welcome to ${member.guild.name}.`,
      'If you want, you can introduce yourself to the community with the button below.',
      'Only you can see this prompt. Your introduction will be posted in the general channel after you submit it.'
    ].join('\n'),
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${customIds.INTRODUCE_SELF}:${member.guild.id}`)
          .setLabel('Tell us about yourself')
          .setStyle(ButtonStyle.Primary)
      )
    ]
  }).catch(error => {
    logger.warn('Failed to send private introduction prompt', error);
  });
}

async function handleGuildMemberUpdate(oldMember, newMember) {
  const communitySettings = await communitySettingsService.ensureGuildSettings(newMember.guild.id);
  const wasEligible = await memberSkillRoleService.memberHasHelperEligibleSkill(oldMember);
  const isEligible = await memberSkillRoleService.memberHasHelperEligibleSkill(newMember);

  if (
    wasEligible &&
    !isEligible &&
    communitySettings.coach_role_id &&
    newMember.roles.cache.has(communitySettings.coach_role_id)
  ) {
    await newMember.roles.remove(communitySettings.coach_role_id).catch(error => {
      logger.warn('Failed to remove helper role after skill downgrade', error);
    });
  }

  if (!wasEligible && isEligible) {
    await maybeSendHelperPrompt(newMember);
  }
}

async function handleGuildMemberAdd(member) {
  const settings = await botSettingsService.ensureGuildSettings(member.guild.id);
  if (!settings.welcome_enabled) return;

  const welcomeChannelId = settings.welcome_channel_id || config.channels.welcome;
  const channel = member.guild.channels.cache.get(welcomeChannelId);
  if (!channel || !channel.isTextBased()) return;

  try {
    const freshGuild = await member.guild.fetch().catch(() => null);
    await channel.send(buildWelcomePayload(member, {
      roleChannelId: settings.role_panel_channel_id || config.channels.rolePanel,
      memberCount: freshGuild?.memberCount || member.guild.memberCount
    }));
    await maybeSendHelperPrompt(member);
  } catch (error) {
    logger.warn('Failed to send welcome message', error);
  }
}

module.exports = {
  handleGuildMemberUpdate,
  handleGuildMemberAdd,
  maybeSendPrivateIntroductionPrompt,
  maybeSendHelperPrompt
};
