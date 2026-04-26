const eventRepository = require('../../../db/repositories/eventRepository');
const xpAuditRepository = require('../../../db/repositories/xpAuditRepository');
const xpService = require('../../leveling/services/xpService');
const logger = require('../../../logger');

async function hasAudit(guildId, userId, sourceType, sourceRef) {
  const audit = await xpAuditRepository.findBySource(guildId, userId, sourceType, sourceRef);
  return Boolean(audit);
}

async function awardOnce(params) {
  const alreadyAwarded = await hasAudit(
    params.guildId,
    params.userId,
    params.sourceType,
    params.sourceRef
  );

  if (alreadyAwarded) {
    return { awarded: false, reason: 'already_awarded' };
  }

  return xpService.awardManualXp(params);
}

async function awardRsvpXp(client, event, userId, previousStatus, nextStatus) {
  if (nextStatus !== 'going' || previousStatus === 'going') {
    return { awarded: false, reason: 'not_new_going_rsvp' };
  }

  return awardOnce({
    client,
    guildId: event.guild_id,
    userId,
    xpDelta: Number(event.xp_rsvp || 0),
    sourceType: 'event_rsvp',
    sourceRef: String(event.id),
    metadata: {
      eventId: event.id,
      title: event.title,
      previousStatus,
      nextStatus
    }
  });
}

async function recordAttendance(client, event, userId, options = {}) {
  const durationSeconds = Math.max(0, Number(options.durationSeconds || 0));
  const participationScore = Math.max(0, Number(options.participationScore || 0));
  const durationBonus = durationSeconds >= 3600 ? Number(event.xp_duration_bonus || 0) : 0;
  const participationBonus = participationScore > 0 ? Number(event.xp_participation_bonus || 0) : 0;
  const xpDelta = Number(event.xp_attendance || 0) + durationBonus + participationBonus;

  const attendance = await eventRepository.upsertAttendance({
    eventId: event.id,
    guildId: event.guild_id,
    userId,
    source: options.source || 'button',
    durationSeconds,
    participationScore,
    xpAwarded: xpDelta
  });

  await eventRepository.upsertEventStreak(event.guild_id, userId, event.id, new Date());

  const award = await awardOnce({
    client,
    guildId: event.guild_id,
    userId,
    xpDelta,
    sourceType: 'event_attendance',
    sourceRef: String(event.id),
    metadata: {
      eventId: event.id,
      title: event.title,
      durationSeconds,
      participationScore,
      durationBonus,
      participationBonus
    }
  });

  return { attendance, award };
}

async function sendPostEventPrompt(client, event) {
  if (!event.channel_id || event.feedback_prompt_sent_at) return false;

  const channel = await client.channels.fetch(event.channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;

  await channel.send({
    content: [
      `**${event.title} wrapped up.**`,
      'Drop your best screenshots or YouTube clips with `/submit` so the community recap has something to feature.',
      'Staff can use the dashboard to review attendance, highlights, and follow-up actions.'
    ].join('\n'),
    allowedMentions: { parse: [] }
  }).catch(error => {
    logger.warn('Failed to send post-event prompt', error);
  });

  await eventRepository.updateEvent(event.guild_id, event.id, {
    feedback_prompt_sent_at: new Date(),
    content_prompt_sent_at: new Date()
  });

  return true;
}

module.exports = {
  awardRsvpXp,
  recordAttendance,
  sendPostEventPrompt
};
