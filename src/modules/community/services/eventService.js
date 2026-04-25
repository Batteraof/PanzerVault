const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const eventRepository = require('../../../db/repositories/eventRepository');
const communitySettingsService = require('../../config/services/communitySettingsService');
const eventXpService = require('../../engagement/services/eventXpService');
const customIds = require('../../../lib/customIds');
const { parseLocalDateTimeString } = require('../utils/dateUtils');
const logger = require('../../../logger');

const RSVP_STATES = {
  GOING: 'going',
  MAYBE: 'maybe',
  NOT_GOING: 'not_going'
};

function buildRsvpCustomId(eventId, state) {
  return `${customIds.EVENT_RSVP_PREFIX}:${eventId}:${state}`;
}

function parseRsvpCustomId(customId) {
  const parts = String(customId || '').split(':');
  if (parts[0] !== customIds.EVENT_RSVP_PREFIX) return null;

  return {
    eventId: Number(parts[1]),
    state: parts[2] || null
  };
}

function buildAttendCustomId(eventId) {
  return `${customIds.EVENT_ATTEND_PREFIX}:${eventId}`;
}

function parseAttendCustomId(customId) {
  const parts = String(customId || '').split(':');
  if (parts[0] !== customIds.EVENT_ATTEND_PREFIX) return null;

  return {
    eventId: Number(parts[1])
  };
}

function buildEventEmbed(event, counts) {
  const timestamp = Math.floor(new Date(event.starts_at).getTime() / 1000);

  const embed = new EmbedBuilder()
    .setColor(event.status === 'cancelled' ? 0xed4245 : 0x5865f2)
    .setTitle(event.title)
    .setDescription(event.description || 'No extra details provided yet.')
    .addFields(
      {
        name: 'Starts',
        value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`,
        inline: true
      },
      {
        name: 'RSVP',
        value: `Going: ${counts.going_count}\nMaybe: ${counts.maybe_count}\nNot Going: ${counts.not_going_count}`,
        inline: true
      },
      {
        name: 'XP',
        value: `RSVP: ${event.xp_rsvp || 0}\nAttend: ${event.xp_attendance || 0}\nBonus: ${Number(event.xp_duration_bonus || 0) + Number(event.xp_participation_bonus || 0)}`,
        inline: true
      }
    )
    .setFooter({ text: `Event #${event.id}` })
    .setTimestamp(new Date(event.created_at || Date.now()));

  if (event.external_url) {
    embed.addFields({
      name: 'Link',
      value: event.external_url,
      inline: false
    });
  }

  if (event.status === 'cancelled' && event.cancellation_reason) {
    embed.addFields({
      name: 'Cancelled',
      value: event.cancellation_reason,
      inline: false
    });
  }

  return embed;
}

function buildEventComponents(event) {
  if (event.status !== 'scheduled') return [];

  const rsvpRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buildRsvpCustomId(event.id, RSVP_STATES.GOING))
      .setLabel('Going')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(buildRsvpCustomId(event.id, RSVP_STATES.MAYBE))
      .setLabel('Maybe')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(buildRsvpCustomId(event.id, RSVP_STATES.NOT_GOING))
      .setLabel('Not Going')
      .setStyle(ButtonStyle.Danger)
  );

  const checkInRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buildAttendCustomId(event.id))
      .setLabel('Check In')
      .setStyle(ButtonStyle.Primary)
  );

  if (event.external_url) {
    return [
      rsvpRow,
      checkInRow,
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Open Link')
          .setStyle(ButtonStyle.Link)
          .setURL(event.external_url)
      )
    ];
  }

  return [rsvpRow, checkInRow];
}

function validateLink(input) {
  if (!input) return null;

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Event links must be valid URLs.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Event links must use http or https.');
  }

  return url.toString();
}

async function renderEventMessage(channel, event) {
  const counts = await eventRepository.getRsvpCounts(event.id);
  return channel.send({
    embeds: [buildEventEmbed(event, counts)],
    components: buildEventComponents(event),
    allowedMentions: { parse: [] }
  });
}

async function refreshEventMessage(client, event) {
  if (!event.message_id) return;

  const channel = await client.channels.fetch(event.channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const message = await channel.messages.fetch(event.message_id).catch(() => null);
  if (!message) return;

  const counts = await eventRepository.getRsvpCounts(event.id);
  await message.edit({
    embeds: [buildEventEmbed(event, counts)],
    components: buildEventComponents(event),
    allowedMentions: { parse: [] }
  }).catch(() => null);
}

async function createEvent(interaction) {
  const startsAtInput = interaction.options.getString('starts_at', true);
  const startsAt = parseLocalDateTimeString(startsAtInput);

  return createEventPrepared(interaction, {
    title: interaction.options.getString('title', true),
    description: interaction.options.getString('description') || null,
    externalUrl: interaction.options.getString('link'),
    startsAt,
    createdBy: interaction.user.id
  });
}

async function createEventPrepared(interaction, data) {
  const settings = await communitySettingsService.ensureGuildSettings(interaction.guild.id);
  if (!settings.event_enabled) {
    throw new Error('Events are currently disabled.');
  }

  if (!settings.event_channel_id) {
    throw new Error('The event channel is not configured yet.');
  }

  const startsAt = data.startsAt instanceof Date ? data.startsAt : parseLocalDateTimeString(data.startsAt);
  if (!startsAt) {
    throw new Error('Use `YYYY-MM-DD HH:MM` for the event time.');
  }

  if (startsAt.getTime() <= Date.now()) {
    throw new Error('The event time must be in the future.');
  }

  const channel = await interaction.client.channels.fetch(settings.event_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error('The configured event channel is missing or not text based.');
  }

  const event = await eventRepository.createEvent({
    guildId: interaction.guild.id,
    channelId: channel.id,
    title: data.title,
    description: data.description || null,
    externalUrl: validateLink(data.externalUrl),
    startsAt,
    createdBy: data.createdBy || interaction.user.id
  });

  const message = await renderEventMessage(channel, event);
  const updates = {
    message_id: message.id
  };

  if (data.endsAt) updates.ends_at = data.endsAt;
  if (data.attendanceChannelId) updates.attendance_channel_id = data.attendanceChannelId;
  if (Number.isFinite(Number(data.xpRsvp))) updates.xp_rsvp = Number(data.xpRsvp);
  if (Number.isFinite(Number(data.xpAttendance))) updates.xp_attendance = Number(data.xpAttendance);

  const updated = await eventRepository.updateEvent(interaction.guild.id, event.id, updates);

  return {
    event: updated,
    message
  };
}

async function cancelEvent(interaction) {
  const eventId = interaction.options.getInteger('event_id', true);
  const reason = interaction.options.getString('reason') || 'Cancelled by staff.';
  const event = await eventRepository.findById(interaction.guild.id, eventId);

  if (!event) {
    throw new Error('That event does not exist.');
  }

  if (event.status !== 'scheduled') {
    throw new Error('That event is no longer active.');
  }

  const updated = await eventRepository.updateEvent(interaction.guild.id, event.id, {
    status: 'cancelled',
    cancelled_at: new Date(),
    cancelled_by: interaction.user.id,
    cancellation_reason: reason
  });

  await refreshEventMessage(interaction.client, updated);
  return updated;
}

async function handleRsvp(interaction) {
  const parsed = parseRsvpCustomId(interaction.customId);
  if (!parsed) return false;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const event = await eventRepository.findById(interaction.guild.id, parsed.eventId);
  if (!event || event.status !== 'scheduled') {
    await interaction.editReply('That event is no longer accepting RSVPs.').catch(() => null);
    return true;
  }

  const previousRsvp = await eventRepository.getUserRsvp(event.id, interaction.user.id);
  await eventRepository.upsertRsvp(event.id, interaction.user.id, parsed.state);

  const xpResult = await eventXpService.awardRsvpXp(
    interaction.client,
    event,
    interaction.user.id,
    previousRsvp ? previousRsvp.status : null,
    parsed.state
  ).catch(() => ({ awarded: false }));

  const xpText = xpResult.awarded ? ` You earned ${xpResult.xpDelta} XP.` : '';
  await interaction.editReply(`RSVP updated: ${parsed.state.replace('_', ' ')}.${xpText}`).catch(() => null);
  await refreshEventMessage(interaction.client, event).catch(error => {
    logger.warn('Failed to refresh event RSVP message', error);
  });
  return true;
}

async function handleAttendance(interaction) {
  const parsed = parseAttendCustomId(interaction.customId);
  if (!parsed) return false;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const event = await eventRepository.findById(interaction.guild.id, parsed.eventId);
  if (!event || !['scheduled', 'completed'].includes(event.status)) {
    await interaction.editReply('That event is no longer accepting check-ins.').catch(() => null);
    return true;
  }

  const startsAt = new Date(event.starts_at);
  if (startsAt.getTime() > Date.now() + 10 * 60 * 1000) {
    await interaction.editReply('Check-in opens shortly before the event starts.').catch(() => null);
    return true;
  }

  const result = await eventXpService.recordAttendance(interaction.client, event, interaction.user.id, {
    source: 'button'
  });

  const xpText = result.award && result.award.awarded
    ? ` You earned ${result.award.xpDelta} XP.`
    : '';

  await interaction.editReply(`Checked in for **${event.title}**.${xpText}`).catch(() => null);
  return true;
}

async function sendReminder(client, event, label) {
  const channel = await client.channels.fetch(event.channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const timestamp = Math.floor(new Date(event.starts_at).getTime() / 1000);
  const messageUrl = event.message_id
    ? `https://discord.com/channels/${event.guild_id}/${event.channel_id}/${event.message_id}`
    : null;

  const lines = [
    `**${label} reminder:** ${event.title}`,
    `<t:${timestamp}:F>`,
    `<t:${timestamp}:R>`
  ];

  if (messageUrl) {
    lines.push(`[Open RSVP post](${messageUrl})`);
  }

  if (event.external_url) {
    lines.push(`[Open link](${event.external_url})`);
  }

  await channel.send({
    content: lines.join('\n'),
    allowedMentions: { parse: [] }
  }).catch(() => null);
}

async function processDueReminders(client, now = new Date()) {
  const [threeDay, oneDay] = await Promise.all([
    eventRepository.listDueForThreeDayReminder(now),
    eventRepository.listDueForOneDayReminder(now)
  ]);

  for (const event of threeDay) {
    await sendReminder(client, event, '3 day');
    await eventRepository.updateEvent(event.guild_id, event.id, {
      reminder_3d_sent_at: new Date()
    });
  }

  for (const event of oneDay) {
    await sendReminder(client, event, '1 day');
    await eventRepository.updateEvent(event.guild_id, event.id, {
      reminder_1d_sent_at: new Date()
    });
  }

  const completed = await eventRepository.markCompletedBefore(now);
  for (const event of completed) {
    await eventXpService.sendPostEventPrompt(client, event);
  }
}

module.exports = {
  createEvent,
  createEventPrepared,
  cancelEvent,
  handleRsvp,
  handleAttendance,
  processDueReminders,
  parseRsvpCustomId,
  parseAttendCustomId,
  buildEventEmbed,
  buildEventComponents,
  validateLink
};

