const db = require('../../../db/client');
const voiceSessionRepository = require('../../../db/repositories/voiceSessionRepository');
const userRepository = require('../../../db/repositories/userRepository');
const xpService = require('./xpService');
const { evaluateVoiceEligibility } = require('../utils/antiAbuse');
const {
  VOICE_XP_SECONDS_PER_POINT,
  VOICE_TRACKING_INTERVAL_MS
} = require('../constants/levelingConfig');
const logger = require('../../../logger');

let timer = null;
let processing = false;

function getStateUserId(voiceState) {
  return voiceState.member ? voiceState.member.id : voiceState.id;
}

function isBotState(voiceState) {
  return Boolean(voiceState && voiceState.member && voiceState.member.user.bot);
}

async function getCurrentVoiceState(client, guildId, userId) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;

  const cachedState = guild.voiceStates.cache.get(userId);
  if (cachedState && cachedState.channelId) return cachedState;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member || !member.voice || !member.voice.channelId) return null;

  return member.voice;
}

async function startSessionForState(voiceState) {
  if (!voiceState || !voiceState.guild || !voiceState.channelId || isBotState(voiceState)) {
    return null;
  }

  const guildId = voiceState.guild.id;
  const userId = getStateUserId(voiceState);
  const channelId = voiceState.channelId;
  const now = new Date();

  return db.withTransaction(async client => {
    const existing = await voiceSessionRepository.findOpenSessionForUser(guildId, userId, client);
    if (existing && existing.channel_id === channelId) {
      return existing;
    }

    if (existing) {
      await voiceSessionRepository.closeSession(existing.id, now, 'stale', client);
    }

    await userRepository.ensureUser(guildId, userId, client);

    return voiceSessionRepository.startSession(
      {
        guildId,
        userId,
        channelId,
        joinedAt: now
      },
      client
    );
  });
}

async function closeSessionForState(voiceState, status = 'closed') {
  if (!voiceState || !voiceState.guild || isBotState(voiceState)) return null;

  const guildId = voiceState.guild.id;
  const userId = getStateUserId(voiceState);
  const session = await voiceSessionRepository.findOpenSessionForUser(guildId, userId);
  if (!session) return null;

  return voiceSessionRepository.closeSession(session.id, new Date(), status);
}

async function processSessionWithState(sessionId, voiceState, discordClient) {
  let awardResult = null;

  await db.withTransaction(async client => {
    const session = await voiceSessionRepository.lockSession(sessionId, client);
    if (!session || session.status !== 'active' || session.left_at) return;

    const now = new Date();
    const lastCheckedAt = new Date(session.last_checked_at || session.joined_at);
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - lastCheckedAt.getTime()) / 1000));

    if (elapsedSeconds <= 0) return;

    const eligibility = evaluateVoiceEligibility(voiceState);
    let updatedSession;

    if (eligibility.eligible) {
      updatedSession = await voiceSessionRepository.addEligibleSeconds(
        session.id,
        elapsedSeconds,
        now,
        client
      );
      await userRepository.incrementVoiceSeconds(session.guild_id, session.user_id, elapsedSeconds, client);
    } else {
      updatedSession = await voiceSessionRepository.markChecked(session.id, now, client);
    }

    const earnedVoiceXp = Math.floor(
      Number(updatedSession.eligible_seconds) / VOICE_XP_SECONDS_PER_POINT
    );
    const unprocessedXp = earnedVoiceXp - Number(updatedSession.awarded_xp);

    if (unprocessedXp <= 0) return;

    awardResult = await xpService.awardXpInTransaction(
      {
        guildId: session.guild_id,
        userId: session.user_id,
        xpDelta: unprocessedXp,
        sourceType: 'voice',
        sourceRef: String(session.id),
        activityAt: now,
        metadata: {
          sessionId: session.id,
          channelId: session.channel_id,
          eligibleSeconds: Number(updatedSession.eligible_seconds),
          eligibility: eligibility.reason
        }
      },
      client
    );

    if (awardResult.awarded) {
      await voiceSessionRepository.addAwardedXp(session.id, awardResult.xpDelta, client);
      return;
    }

    if (
      awardResult.reason === 'max_level' ||
      awardResult.reason === 'voice_xp_disabled' ||
      awardResult.reason === 'leveling_disabled'
    ) {
      await voiceSessionRepository.addAwardedXp(session.id, unprocessedXp, client);
    }
  });

  if (awardResult && awardResult.awarded) {
    await xpService.finalizeAward(discordClient, awardResult);
  }
}

async function processMemberSession(voiceState, discordClient) {
  if (!voiceState || !voiceState.guild || isBotState(voiceState)) return;

  const guildId = voiceState.guild.id;
  const userId = getStateUserId(voiceState);
  const session = await voiceSessionRepository.findOpenSessionForUser(guildId, userId);
  if (!session) return;

  await processSessionWithState(session.id, voiceState, discordClient);
}

async function handleVoiceStateUpdate(oldState, newState, discordClient) {
  const member = newState.member || oldState.member;
  if (member && member.user.bot) return;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  if (oldChannelId) {
    await processMemberSession(oldState, discordClient);
  }

  if (oldChannelId && oldChannelId !== newChannelId) {
    await closeSessionForState(oldState, 'closed');
  }

  if (newChannelId && oldChannelId !== newChannelId) {
    await startSessionForState(newState);
  }
}

async function processActiveSessionRecord(session, discordClient) {
  const voiceState = await getCurrentVoiceState(discordClient, session.guild_id, session.user_id);
  const now = new Date();

  if (!voiceState || !voiceState.channelId) {
    await voiceSessionRepository.closeSession(session.id, now, 'stale');
    return;
  }

  if (voiceState.channelId !== session.channel_id) {
    await voiceSessionRepository.closeSession(session.id, now, 'stale');
    await startSessionForState(voiceState);
    return;
  }

  await processSessionWithState(session.id, voiceState, discordClient);
}

async function processActiveSessions(discordClient) {
  if (processing) return;
  processing = true;

  try {
    const sessions = await voiceSessionRepository.getActiveSessions();
    for (const session of sessions) {
      try {
        await processActiveSessionRecord(session, discordClient);
      } catch (error) {
        logger.warn('Failed to process voice session', session.id, error);
      }
    }
  } finally {
    processing = false;
  }
}

async function recoverOpenSessions(discordClient) {
  const sessions = await voiceSessionRepository.getActiveSessions();
  const now = new Date();

  for (const session of sessions) {
    const voiceState = await getCurrentVoiceState(discordClient, session.guild_id, session.user_id);

    if (voiceState && voiceState.channelId === session.channel_id) {
      await voiceSessionRepository.markChecked(session.id, now);
      logger.info('Recovered active voice session', session.id);
      continue;
    }

    await voiceSessionRepository.closeSession(session.id, now, 'stale');
    logger.info('Closed stale voice session during recovery', session.id);

    if (voiceState && voiceState.channelId) {
      await startSessionForState(voiceState);
    }
  }
}

function start(discordClient) {
  if (timer) return;

  timer = setInterval(() => {
    processActiveSessions(discordClient).catch(error => {
      logger.warn('Voice tracking interval failed', error);
    });
  }, VOICE_TRACKING_INTERVAL_MS);

  if (timer.unref) timer.unref();
}

function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  handleVoiceStateUpdate,
  recoverOpenSessions,
  processActiveSessions,
  startSessionForState,
  start,
  stop
};
