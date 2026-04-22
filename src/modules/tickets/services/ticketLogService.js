const { EmbedBuilder } = require('discord.js');

async function fetchTextChannel(client, channelId) {
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return null;
  return channel;
}

async function sendTicketLog(client, settings, title, fields, color = 0x5865F2) {
  if (!settings || !settings.log_channel_id) return;

  const channel = await fetchTextChannel(client, settings.log_channel_id);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(fields)
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] }
  });
}

module.exports = {
  sendTicketLog
};
