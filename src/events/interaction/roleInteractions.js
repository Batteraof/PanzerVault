const { ActionRowBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../config');
const customIds = require('../../lib/customIds');
const { buildRoleMenu } = require('../../lib/rolePanel');
const logger = require('../../logger');

async function handleRoleButton(interaction) {
  if (interaction.customId === customIds.JOIN_INFO) {
    return interaction.reply({
      content:
        `🎉 Welcome! Check our rules and enjoy your stay. If you have any questions, don't be shy to ask ☺️ Ready to play? Go to <#${config.channels.gameChannelId}> and use <@&${config.channels.readyRoleId}>!`,
      ephemeral: true
    });
  }

  if (interaction.customId === customIds.ROLES_MENU) {
    const row = new ActionRowBuilder().addComponents(buildRoleMenu());

    return interaction.reply({
      content: '🎭 Choose your roles below:',
      components: [row],
      ephemeral: true
    });
  }

  return null;
}

async function handleRoleSelect(interaction) {
  if (interaction.customId !== customIds.ROLE_SELECT) return false;

  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member;
  const botMember = interaction.guild.members.me;

  try {
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await interaction.editReply('❌ I do not have permission to manage roles.');
      return true;
    }

    for (const roleId of Object.values(config.roleMap)) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role || !member.roles.cache.has(role.id)) continue;
      await member.roles.remove(role);
    }

    for (const key of interaction.values) {
      const role = interaction.guild.roles.cache.get(config.roleMap[key]);
      if (!role) continue;
      if (botMember.roles.highest.comparePositionTo(role) <= 0) continue;
      await member.roles.add(role);
    }

    await interaction.editReply('✅ Your roles have been updated successfully!');
    return true;
  } catch (error) {
    logger.error('Failed to update self roles', error);
    await interaction.editReply('❌ Something went wrong while updating roles.');
    return true;
  }
}

async function handleRoleInteraction(interaction) {
  if (interaction.isButton()) {
    const handled = await handleRoleButton(interaction);
    return Boolean(handled);
  }

  if (interaction.isStringSelectMenu()) {
    return handleRoleSelect(interaction);
  }

  return false;
}

module.exports = {
  handleRoleInteraction
};
