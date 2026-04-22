const { AFK_VOICE_CHANNEL_IDS } = require('../constants/levelingConfig');

function isEligibleTextMessage(message) {
  if (!message || !message.guild) return false;
  if (message.author.bot) return false;
  if (!message.content || message.content.trim().length === 0) return false;
  return true;
}

function normalizeForSimilarity(content) {
  return String(content || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldSkipForRepeatedSimilarity() {
  return false;
}

function isAfkChannel(voiceState) {
  if (!voiceState || !voiceState.channelId) return true;
  if (AFK_VOICE_CHANNEL_IDS.includes(voiceState.channelId)) return true;
  return voiceState.guild && voiceState.guild.afkChannelId === voiceState.channelId;
}

function evaluateVoiceEligibility(voiceState) {
  if (!voiceState || !voiceState.channel) {
    return { eligible: false, reason: 'not_in_voice' };
  }

  if (isAfkChannel(voiceState)) {
    return { eligible: false, reason: 'afk_channel' };
  }

  if (voiceState.selfDeaf) {
    return { eligible: false, reason: 'self_deafened' };
  }

  const humanMemberCount = voiceState.channel.members.filter(member => !member.user.bot).size;
  if (humanMemberCount <= 1) {
    return { eligible: false, reason: 'alone' };
  }

  return { eligible: true, reason: 'eligible' };
}

module.exports = {
  isEligibleTextMessage,
  normalizeForSimilarity,
  shouldSkipForRepeatedSimilarity,
  evaluateVoiceEligibility
};
