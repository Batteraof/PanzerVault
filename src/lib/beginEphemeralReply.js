const { MessageFlags } = require('discord.js');

async function beginEphemeralReply(interaction, content = 'Working...') {
  if (interaction.deferred || interaction.replied) {
    return;
  }

  await interaction.reply({
    content,
    flags: MessageFlags.Ephemeral
  });
}

module.exports = {
  beginEphemeralReply
};
