const { EmbedBuilder } = require('discord.js');
const db = require('../../../db/client');
const messageActivityRepository = require('../../../db/repositories/messageActivityRepository');
const videoSubmissionRepository = require('../../../db/repositories/videoSubmissionRepository');
const eventRepository = require('../../../db/repositories/eventRepository');
const communitySettingsService = require('../../config/services/communitySettingsService');
const schedulerStateRepository = require('../../../db/repositories/schedulerStateRepository');
const { addDays, startOfWeek, weekKeyFromDate } = require('../utils/dateUtils');

async function voiceHoursBetween(guildId, start, end) {
  const result = await db.query(
    `
    SELECT COALESCE(SUM(eligible_seconds), 0)::integer AS seconds
    FROM voice_sessions
    WHERE guild_id = $1
      AND joined_at >= $2
      AND joined_at < $3
    `,
    [guildId, start, end]
  );

  return (result.rows[0]?.seconds || 0) / 3600;
}

async function galleryCountBetween(guildId, start, end) {
  const result = await db.query(
    `
    SELECT COUNT(*)::integer AS count
    FROM gallery_submissions
    WHERE guild_id = $1
      AND status = 'posted'
      AND created_at >= $2
      AND created_at < $3
    `,
    [guildId, start, end]
  );

  return result.rows[0] ? result.rows[0].count : 0;
}

async function buildRecapEmbed(guild, start, end, note) {
  const [messageCount, uniqueChatters, topChannels, galleryCount, videoCount, eventCount, voiceHours] = await Promise.all([
    messageActivityRepository.countBetween(guild.id, start, end),
    messageActivityRepository.countUniqueChattersBetween(guild.id, start, end),
    messageActivityRepository.topChannelsBetween(guild.id, start, end, 3),
    galleryCountBetween(guild.id, start, end),
    videoSubmissionRepository.countPostedBetween(guild.id, start, end),
    eventRepository.countCreatedBetween(guild.id, start, end),
    voiceHoursBetween(guild.id, start, end)
  ]);

  const members = await guild.members.fetch().catch(() => null);
  const newMembers = members
    ? members.filter(member => member.joinedTimestamp >= start.getTime() && member.joinedTimestamp < end.getTime()).size
    : 0;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Weekly Server Recap')
    .setDescription(`A quick look back at the last week in **${guild.name}**.`)
    .addFields(
      { name: 'Messages', value: String(messageCount), inline: true },
      { name: 'Unique Chatters', value: String(uniqueChatters), inline: true },
      { name: 'New Members', value: String(newMembers), inline: true },
      { name: 'Voice Hours', value: voiceHours.toFixed(1), inline: true },
      { name: 'Gallery Posts', value: String(galleryCount), inline: true },
      { name: 'Video Posts', value: String(videoCount), inline: true },
      { name: 'Events Created', value: String(eventCount), inline: true },
      {
        name: 'Top Active Channels',
        value: topChannels.length > 0
          ? topChannels.map(row => `<#${row.channel_id}> - ${row.message_count} messages`).join('\n')
          : 'No standout channel activity this week.',
        inline: false
      }
    )
    .setFooter({ text: `Week of ${start.toLocaleDateString()}` })
    .setTimestamp(end);

  if (note) {
    embed.addFields({
      name: 'Staff Highlight',
      value: note,
      inline: false
    });
  }

  return embed;
}

async function maybePostWeeklyRecap(client, guild) {
  const settings = await communitySettingsService.ensureGuildSettings(guild.id);
  if (!settings.weekly_recap_enabled || !settings.community_channel_id) return;

  const state = await schedulerStateRepository.ensureState(guild.id);
  const now = new Date();
  const weekKey = weekKeyFromDate(now);
  const isMonday = now.getDay() === 1;
  if (!isMonday || state.last_weekly_recap_week === weekKey) return;

  const start = addDays(startOfWeek(now), -7);
  const end = startOfWeek(now);
  const channel = await client.channels.fetch(settings.community_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = await buildRecapEmbed(guild, start, end, settings.weekly_recap_note);
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
  await schedulerStateRepository.updateState(guild.id, { last_weekly_recap_week: weekKey });
  await communitySettingsService.updateSettings(guild.id, { weekly_recap_note: null });
}

module.exports = {
  maybePostWeeklyRecap
};
