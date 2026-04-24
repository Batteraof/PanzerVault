async function beginEphemeralReply(interaction, content = 'Working...') {
  if (interaction.deferred || interaction.replied) {
    return;
  }

  await interaction.reply({
    content,
    ephemeral: true
  });
}

module.exports = {
  beginEphemeralReply
};
