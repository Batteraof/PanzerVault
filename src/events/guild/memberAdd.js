const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const config = require('../../config');
const customIds = require('../../lib/customIds');
const botSettingsService = require('../../modules/config/services/botSettingsService');
const communitySettingsService = require('../../modules/config/services/communitySettingsService');
const memberSkillRoleService = require('../../modules/config/services/memberSkillRoleService');
const logger = require('../../logger');

function parseChannelIdFromUrl(url = '') {
  const match = String(url).match(/\/channels\/\d+\/(\d+)/);
  return match ? match[1] : null;
}

function getGeneralChannelId() {
  return config.channels.generalChannelId || parseChannelIdFromUrl(config.channels.generalUrl);
}

async function fetchGeneralChannel(guild) {
  const channelId = getGeneralChannelId();
  if (!channelId) return null;

  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return null;
  return channel;
}

async function maybeSendHelperPrompt(member, channel = null) {
  const communitySettings = await communitySettingsService.ensureGuildSettings(member.guild.id);
  if (!communitySettings.coach_role_id || member.roles.cache.has(communitySettings.coach_role_id)) return;

  const eligible = await memberSkillRoleService.memberHasHelperEligibleSkill(member);
  if (!eligible) return;

  const promptChannel = channel && channel.isTextBased() ? channel : await fetchGeneralChannel(member.guild);
  if (!promptChannel) return;

  const permissions = promptChannel.permissionsFor(member.guild.members.me);
  if (!permissions || !permissions.has(PermissionFlagsBits.SendMessages)) return;

  await promptChannel.send({
    content: `${member}, because you joined as Medium or Expert, do you want the helper role so Beginners know they can ask you for help?`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customIds.COACH_TOGGLE)
          .setLabel('I can help beginners')
          .setStyle(ButtonStyle.Primary)
      )
    ],
    allowedMentions: { users: [member.id], roles: [] }
  }).catch(error => {
    logger.warn('Failed to send helper prompt', error);
  });
}

async function handleGuildMemberUpdate(oldMember, newMember) {
  const wasEligible = await memberSkillRoleService.memberHasHelperEligibleSkill(oldMember);
  const isEligible = await memberSkillRoleService.memberHasHelperEligibleSkill(newMember);

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

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`Welcome to ${member.guild.name}`)
    .setDescription(`Hey ${member}, glad you made it in. Discord already handled the basics, so the next step is just getting settled and saying hello when you feel like it.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setImage('https://i.imgur.com/jNjayEQ.png')
    .addFields(
      { name: 'Members', value: `${member.guild.memberCount}`, inline: true },
      { name: 'Site', value: 'Server overview, links, events, and community info live there.', inline: false },
      { name: 'General', value: 'Introduce yourself if you want. Members can wave back to welcome you.', inline: false }
    )
    .setFooter({ text: 'Enjoy your stay.' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Tell us about yourself')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(customIds.INTRODUCE_SELF),
      new ButtonBuilder()
        .setLabel('Visit the site')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(customIds.SITE_INFO)
    );

  try {
    await channel.send({
      embeds: [embed],
      components: [row]
    });
    await maybeSendHelperPrompt(member, channel);
  } catch (error) {
    logger.warn('Failed to send welcome message', error);
  }
}

module.exports = {
  handleGuildMemberUpdate,
  handleGuildMemberAdd,
  maybeSendHelperPrompt
};
