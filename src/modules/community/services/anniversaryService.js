const { EmbedBuilder } = require('discord.js');
const schedulerStateRepository = require('../../../db/repositories/schedulerStateRepository');
const guildSettingsRepository = require('../../../db/repositories/guildSettingsRepository');
const communitySettingsService = require('../../config/services/communitySettingsService');
const { anniversaryLabel, monthsSince } = require('../utils/dateUtils');

function qualifies(months) {
  return months === 3 || months === 6 || (months >= 12 && months % 12 === 0);
}

async function maybePostAnniversaries(client, guild) {
  const [communitySettings, levelingSettings, state] = await Promise.all([
    communitySettingsService.ensureGuildSettings(guild.id),
    guildSettingsRepository.ensureSettings(guild.id),
    schedulerStateRepository.ensureState(guild.id)
  ]);

  if (!communitySettings.anniversary_enabled) return;

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  if (state.last_anniversary_date === todayKey) return;

  const channelId = levelingSettings.levelup_channel_id || levelingSettings.info_channel_id;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const members = await guild.members.fetch().catch(() => null);
  if (!members) return;

  const anniversaries = [];

  for (const member of members.values()) {
    if (!member.joinedTimestamp) continue;

    const joinedAt = new Date(member.joinedTimestamp);
    if (joinedAt.getDate() !== today.getDate() || joinedAt.getMonth() !== today.getMonth()) {
      continue;
    }

    const totalMonths = monthsSince(joinedAt, today);
    if (!qualifies(totalMonths)) continue;

    anniversaries.push({
      member,
      label: anniversaryLabel(totalMonths)
    });
  }

  if (anniversaries.length > 0) {
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Server Anniversary Shoutout')
      .setDescription('A quick thank-you to members hitting a server milestone today.')
      .addFields(
        anniversaries.map(item => ({
          name: item.member.displayName,
          value: `${item.member} has been here for **${item.label}**.`,
          inline: false
        }))
      )
      .setTimestamp();

    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
  }

  await schedulerStateRepository.updateState(guild.id, { last_anniversary_date: todayKey });
}

module.exports = {
  maybePostAnniversaries
};
