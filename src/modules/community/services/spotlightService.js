const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const spotlightRepository = require('../../../db/repositories/spotlightRepository');
const communitySettingsService = require('../../config/services/communitySettingsService');
const customIds = require('../../../lib/customIds');
const { monthKeyFromDate } = require('../utils/dateUtils');
const logger = require('../../../logger');

const REASON_TAGS = [
  { key: 'helpful', label: 'Helpful' },
  { key: 'creative', label: 'Creative' },
  { key: 'funny', label: 'Funny' },
  { key: 'active', label: 'Active' },
  { key: 'supportive', label: 'Supportive' }
];

function reasonLabel(reasonTag) {
  return REASON_TAGS.find(tag => tag.key === reasonTag)?.label || 'Community Pick';
}

function previousMonthKey(date, monthsBack) {
  const value = new Date(date);
  value.setMonth(value.getMonth() - monthsBack);
  return monthKeyFromDate(value);
}

function buildVoteCustomId(cycleId, nomineeUserId) {
  return `${customIds.SPOTLIGHT_VOTE_PREFIX}:${cycleId}:${nomineeUserId}`;
}

function parseVoteCustomId(customId) {
  const parts = String(customId || '').split(':');
  if (parts[0] !== customIds.SPOTLIGHT_VOTE_PREFIX) return null;

  return {
    cycleId: Number(parts[1]),
    nomineeUserId: parts[2] || null
  };
}

function cycleDate(cycle, snakeKey, camelKey) {
  return new Date(cycle[snakeKey] || cycle[camelKey]).getTime();
}

function cyclePhase(cycle, now = new Date()) {
  const current = now.getTime();
  if (current < cycleDate(cycle, 'voting_starts_at', 'votingStartsAt')) return 'nominations';
  if (current <= cycleDate(cycle, 'voting_ends_at', 'votingEndsAt')) return 'voting';
  if (current < cycleDate(cycle, 'announcement_at', 'announcementAt')) return 'voting_closed';
  return 'announcement';
}

function buildCycleSchedule(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  return {
    monthKey: monthKeyFromDate(now),
    nominationStartsAt: new Date(year, month, 1, 0, 0, 0, 0),
    nominationEndsAt: new Date(year, month, 20, 23, 59, 59, 999),
    votingStartsAt: new Date(year, month, 21, 0, 0, 0, 0),
    votingEndsAt: new Date(year, month, 27, 23, 59, 59, 999),
    announcementAt: new Date(year, month, lastDay, 12, 0, 0, 0)
  };
}

async function ensureCurrentCycle(guildId, now = new Date()) {
  const schedule = buildCycleSchedule(now);
  return spotlightRepository.createCycle({
    guildId,
    monthKey: schedule.monthKey,
    nominationStartsAt: schedule.nominationStartsAt,
    nominationEndsAt: schedule.nominationEndsAt,
    votingStartsAt: schedule.votingStartsAt,
    votingEndsAt: schedule.votingEndsAt,
    announcementAt: schedule.announcementAt,
    status: cyclePhase(schedule, now) === 'voting' ? 'voting' : 'nominations'
  });
}

async function currentCycle(guildId) {
  return ensureCurrentCycle(guildId, new Date());
}

async function finalistsForCycle(guildId, cycle, limit = 5) {
  const sinceMonthKey = previousMonthKey(new Date(cycle.nomination_starts_at), 3);
  const recentWinners = new Set(await spotlightRepository.getRecentWinners(guildId, sinceMonthKey));
  const topNominees = await spotlightRepository.listTopNominees(cycle.id, limit + 5);

  return topNominees
    .filter(row => !recentWinners.has(row.nominee_user_id))
    .slice(0, limit);
}

async function buildVotingMessage(guild, cycle) {
  const finalists = await finalistsForCycle(guild.id, cycle);
  const voteCounts = await spotlightRepository.getVoteCounts(cycle.id);
  const voteCountMap = new Map(voteCounts.map(row => [row.nominee_user_id, Number(row.vote_count)]));

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('Community Spotlight Voting')
    .setDescription(
      finalists.length > 0
        ? 'Vote for the member you want to highlight this month. One vote per member.'
        : 'No finalists are available for voting this month.'
    )
    .setFooter({ text: `Spotlight ${cycle.month_key}` })
    .setTimestamp();

  if (finalists.length > 0) {
    embed.addFields(
      finalists.map(row => ({
        name: guild.members.cache.get(row.nominee_user_id)?.displayName || row.nominee_user_id,
        value: `Nominations: ${row.nomination_count}\nVotes: ${voteCountMap.get(row.nominee_user_id) || 0}\nTheme: ${reasonLabel(row.reason_tag)}`,
        inline: true
      }))
    );
  }

  const components = finalists.length > 0
    ? [
        new ActionRowBuilder().addComponents(
          finalists.map(row =>
            new ButtonBuilder()
              .setCustomId(buildVoteCustomId(cycle.id, row.nominee_user_id))
              .setLabel(guild.members.cache.get(row.nominee_user_id)?.displayName?.slice(0, 80) || row.nominee_user_id)
              .setStyle(ButtonStyle.Primary)
          )
        )
      ]
    : [];

  return { embeds: [embed], components };
}

async function refreshVotingMessage(client, guildId, cycle) {
  const settings = await communitySettingsService.ensureGuildSettings(guildId);
  if (!settings.spotlight_enabled || !settings.spotlight_channel_id) return cycle;

  const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return cycle;
  await guild.members.fetch().catch(() => null);

  const channel = await client.channels.fetch(settings.spotlight_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return cycle;

  const payload = await buildVotingMessage(guild, cycle);
  let message = null;

  if (cycle.vote_message_id) {
    message = await channel.messages.fetch(cycle.vote_message_id).catch(() => null);
  }

  if (message) {
    await message.edit({ ...payload, allowedMentions: { parse: [] } });
    return cycle;
  }

  const created = await channel.send({ ...payload, allowedMentions: { parse: [] } });
  return spotlightRepository.updateCycle(cycle.id, { vote_message_id: created.id, status: 'voting' });
}

async function announceWinner(client, guildId, cycle, forcedWinnerUserId = null) {
  const settings = await communitySettingsService.ensureGuildSettings(guildId);
  if (!settings.spotlight_channel_id) return cycle;

  const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return cycle;
  await guild.members.fetch().catch(() => null);

  const finalists = await finalistsForCycle(guildId, cycle);
  const counts = await spotlightRepository.getVoteCounts(cycle.id);
  const finalistsSet = new Set(finalists.map(row => row.nominee_user_id));
  const finalistCounts = counts.filter(row => finalistsSet.has(row.nominee_user_id));

  let winnerUserId = forcedWinnerUserId;
  if (!winnerUserId) {
    if (finalistCounts.length === 0) {
      const channel = await client.channels.fetch(settings.spotlight_channel_id).catch(() => null);
      if (channel && channel.isTextBased()) {
        const message = await channel.send({
          content: `No Community Spotlight winner for ${cycle.month_key}. We did not get enough nominations or votes this month.`,
          allowedMentions: { parse: [] }
        }).catch(() => null);

        return spotlightRepository.updateCycle(cycle.id, {
          status: 'announced',
          announcement_message_id: message ? message.id : null
        });
      }

      return spotlightRepository.updateCycle(cycle.id, { status: 'announced' });
    }

    const maxVotes = Math.max(...finalistCounts.map(row => Number(row.vote_count)));
    const tied = finalistCounts.filter(row => Number(row.vote_count) === maxVotes);
    if (tied.length > 1) {
      logger.warn('Spotlight tie requires manual resolution', { guildId, cycleId: cycle.id });
      return cycle;
    }

    winnerUserId = tied[0].nominee_user_id;
  }

  const winnerNominations = await spotlightRepository.listActiveNominations(cycle.id);
  const winnerReason = winnerNominations.find(row => row.nominee_user_id === winnerUserId)?.reason_tag || 'supportive';
  const channel = await client.channels.fetch(settings.spotlight_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return cycle;

  if (settings.spotlight_role_id) {
    const role = guild.roles.cache.get(settings.spotlight_role_id);
    if (role) {
      await guild.members.fetch().catch(() => null);
      for (const member of role.members.values()) {
        await member.roles.remove(role).catch(() => null);
      }

      const winnerMember = await guild.members.fetch(winnerUserId).catch(() => null);
      if (winnerMember) {
        await winnerMember.roles.add(role).catch(() => null);
      }
    }
  }

  const winnerMember = await guild.members.fetch(winnerUserId).catch(() => null);
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Community Spotlight Winner')
    .setDescription(
      winnerMember
        ? `${winnerMember} is the Community Spotlight winner for ${cycle.month_key}.`
        : `Winner for ${cycle.month_key}: <@${winnerUserId}>`
    )
    .addFields(
      { name: 'Theme', value: reasonLabel(winnerReason), inline: true },
      { name: 'Spotlight Role', value: settings.spotlight_role_id ? `<@&${settings.spotlight_role_id}> for one month` : 'Recognition only', inline: true }
    )
    .setFooter({ text: `Spotlight ${cycle.month_key}` })
    .setTimestamp();

  const message = await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] }
  }).catch(() => null);

  return spotlightRepository.updateCycle(cycle.id, {
    status: 'announced',
    winner_user_id: winnerUserId,
    winner_reason_tag: winnerReason,
    announcement_message_id: message ? message.id : null
  });
}

async function nominate(interaction) {
  const settings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
  if (!settings.spotlight_enabled || !settings.spotlight_channel_id) {
    throw new Error('Community Spotlight is not configured yet.');
  }

  const cycle = await currentCycle(interaction.guild.id);
  if (cyclePhase(cycle) !== 'nominations') {
    throw new Error('Spotlight nominations are closed right now.');
  }

  const nominee = interaction.options.getUser('member', true);
  const reasonTag = interaction.options.getString('category', true);
  const reasonText = interaction.options.getString('reason', true);

  if (nominee.id === interaction.user.id) {
    throw new Error('You cannot nominate yourself.');
  }

  const member = await interaction.guild.members.fetch(nominee.id).catch(() => null);
  if (!member) {
    throw new Error('That member is not in this server.');
  }

  if (Date.now() - member.joinedTimestamp < 30 * 24 * 60 * 60 * 1000) {
    throw new Error('Members need to be in the server for at least 30 days before they can be spotlight nominees.');
  }

  const recentWinners = await spotlightRepository.getRecentWinners(
    interaction.guild.id,
    previousMonthKey(new Date(), 3)
  );
  if (recentWinners.includes(nominee.id)) {
    throw new Error('That member is on the spotlight cooldown and cannot win again yet.');
  }

  try {
    const nomination = await spotlightRepository.addNomination({
      cycleId: cycle.id,
      guildId: interaction.guild.id,
      nominatorUserId: interaction.user.id,
      nomineeUserId: nominee.id,
      reasonTag,
      reasonText
    });

    return nomination;
  } catch (error) {
    if (String(error.message).includes('unique')) {
      throw new Error('You already submitted your nomination for this month.');
    }
    throw error;
  }
}

async function disqualifyNominee(client, guildId, userId, removedBy, reason) {
  const cycle = await currentCycle(guildId);
  const rows = await spotlightRepository.removeNomineeFromCycle(cycle.id, userId, removedBy, reason);
  if (rows.length === 0) {
    throw new Error('That member is not an active nominee this month.');
  }

  if (cycle.status === 'voting') {
    await refreshVotingMessage(client, guildId, cycle);
  }

  return rows.length;
}

async function syncCycle(client, guildId) {
  const settings = await communitySettingsService.ensureGuildSettings(guildId);
  if (!settings.spotlight_enabled || !settings.spotlight_channel_id) return;

  const cycle = await currentCycle(guildId);
  const phase = cyclePhase(cycle);

  if (phase === 'voting' && cycle.status !== 'announced') {
    await refreshVotingMessage(client, guildId, cycle);
    return;
  }

  if (phase === 'announcement' && cycle.status !== 'announced') {
    await announceWinner(client, guildId, cycle);
  }
}

async function handleVote(interaction) {
  const parsed = parseVoteCustomId(interaction.customId);
  if (!parsed) return false;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const cycle = await spotlightRepository.getCycleById(parsed.cycleId);
  if (!cycle) {
    await interaction.editReply('That spotlight vote is no longer active.').catch(() => null);
    return true;
  }

  if (cyclePhase(cycle) !== 'voting') {
    await interaction.editReply('Spotlight voting is closed right now.').catch(() => null);
    return true;
  }

  const finalists = await finalistsForCycle(interaction.guild.id, cycle);
  const finalistIds = new Set(finalists.map(row => row.nominee_user_id));
  if (!finalistIds.has(parsed.nomineeUserId)) {
    await interaction.editReply('That nominee is no longer in the final vote.').catch(() => null);
    return true;
  }

  await spotlightRepository.upsertVote(cycle.id, interaction.guild.id, interaction.user.id, parsed.nomineeUserId);
  await interaction.editReply(`Vote saved for <@${parsed.nomineeUserId}>.`).catch(() => null);
  await refreshVotingMessage(interaction.client, interaction.guild.id, cycle).catch(error => {
    logger.warn('Failed to refresh spotlight voting message', error);
  });
  return true;
}

async function getInfo(guildId) {
  const cycle = await currentCycle(guildId);
  const phase = cyclePhase(cycle);
  const finalists = phase === 'voting'
    ? await finalistsForCycle(guildId, cycle)
    : [];

  return {
    cycle,
    phase,
    finalists
  };
}

async function resolveTie(client, guildId, userId) {
  const cycle = await currentCycle(guildId);
  return announceWinner(client, guildId, cycle, userId);
}

module.exports = {
  REASON_TAGS,
  nominate,
  getInfo,
  disqualifyNominee,
  syncCycle,
  handleVote,
  resolveTie,
  parseVoteCustomId
};
