const { PermissionFlagsBits } = require('discord.js');
const botSettingsService = require('../../config/services/botSettingsService');
const guildSettingsRepository = require('../../../db/repositories/guildSettingsRepository');
const gallerySettingsService = require('../../gallery/services/gallerySettingsService');
const gallerySettingsRepository = require('../../../db/repositories/gallerySettingsRepository');
const galleryTagService = require('../../gallery/services/galleryTagService');
const rewardRoleService = require('../../rewards/services/rewardRoleService');
const ticketSettingsService = require('../../tickets/services/ticketSettingsService');
const userRepository = require('../../../db/repositories/userRepository');

function assertManageGuild(interaction) {
  if (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('You need Manage Server permission to use config commands.');
  }
}

async function handleWelcome(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'channel') {
    const channel = interaction.options.getChannel('channel', true);
    await botSettingsService.updateWelcomeChannel(interaction.guild.id, channel.id);
    return `Welcome messages will now use ${channel}.`;
  }

  if (subcommand === 'enabled') {
    const enabled = interaction.options.getBoolean('enabled', true);
    await botSettingsService.updateWelcomeEnabled(interaction.guild.id, enabled);
    return `Welcome messages are now ${enabled ? 'enabled' : 'disabled'}.`;
  }

  return 'Unknown welcome config action.';
}

async function handleLeveling(interaction) {
  const subcommand = interaction.options.getSubcommand();
  await guildSettingsRepository.ensureSettings(interaction.guild.id);

  if (subcommand === 'channel') {
    const channel = interaction.options.getChannel('channel', true);
    await guildSettingsRepository.updateSettings(interaction.guild.id, {
      levelup_channel_id: channel.id
    });
    return `Level-up announcements will now use ${channel}.`;
  }

  if (subcommand === 'enabled') {
    const enabled = interaction.options.getBoolean('enabled', true);
    await guildSettingsRepository.updateSettings(interaction.guild.id, {
      leveling_enabled: enabled
    });
    return `Leveling is now ${enabled ? 'enabled' : 'disabled'}.`;
  }

  if (subcommand === 'text-xp') {
    const enabled = interaction.options.getBoolean('enabled', true);
    await guildSettingsRepository.updateSettings(interaction.guild.id, {
      text_xp_enabled: enabled
    });
    return `Text XP is now ${enabled ? 'enabled' : 'disabled'}.`;
  }

  if (subcommand === 'voice-xp') {
    const enabled = interaction.options.getBoolean('enabled', true);
    await guildSettingsRepository.updateSettings(interaction.guild.id, {
      voice_xp_enabled: enabled
    });
    return `Voice XP is now ${enabled ? 'enabled' : 'disabled'}.`;
  }

  if (subcommand === 'dm-levelups') {
    const enabled = interaction.options.getBoolean('enabled', true);
    await guildSettingsRepository.updateSettings(interaction.guild.id, {
      dm_levelup_enabled: enabled
    });
    return `Level-up DMs are now ${enabled ? 'enabled' : 'disabled'}.`;
  }

  return 'Unknown leveling config action.';
}

function categoryArrayFromOption(category) {
  if (!category || category === 'all') return null;
  return [category];
}

async function handleGallery(interaction) {
  const subcommand = interaction.options.getSubcommand();
  await gallerySettingsService.ensureGuildSettings(interaction.guild.id);

  if (subcommand === 'showcase-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await gallerySettingsRepository.updateSettings(interaction.guild.id, {
      showcase_channel_id: channel.id
    });
    return `Showcase gallery posts will now use ${channel}.`;
  }

  if (subcommand === 'meme-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await gallerySettingsRepository.updateSettings(interaction.guild.id, {
      meme_channel_id: channel.id
    });
    return `Meme gallery posts will now use ${channel}.`;
  }

  if (subcommand === 'log-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await gallerySettingsRepository.updateSettings(interaction.guild.id, {
      log_channel_id: channel.id
    });
    return `Gallery moderation logs will now use ${channel}.`;
  }

  if (subcommand === 'enabled') {
    const enabled = interaction.options.getBoolean('enabled', true);
    await gallerySettingsRepository.updateSettings(interaction.guild.id, {
      gallery_enabled: enabled
    });
    return `Gallery submissions are now ${enabled ? 'enabled' : 'disabled'}.`;
  }

  if (subcommand === 'add-tag') {
    const name = interaction.options.getString('name', true);
    const category = interaction.options.getString('category') || 'all';
    const tag = await galleryTagService.addTag(
      interaction.guild.id,
      name,
      categoryArrayFromOption(category)
    );
    return `Approved gallery tag added: ${tag.tag_name}.`;
  }

  if (subcommand === 'remove-tag') {
    const name = interaction.options.getString('name', true);
    const tag = await galleryTagService.removeTag(interaction.guild.id, name);

    if (!tag) {
      return 'That approved gallery tag was not active or did not exist.';
    }

    return `Approved gallery tag removed: ${tag.tag_name}.`;
  }

  return 'Unknown gallery config action.';
}

async function handleRewards(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add-role') {
    const role = interaction.options.getRole('role', true);
    const level = interaction.options.getInteger('level', true);
    const reward = await rewardRoleService.addReward(
      interaction.guild.id,
      role.id,
      level,
      interaction.user.id
    );

    return `Reward role ${role} will be assigned at level ${reward.required_level}.`;
  }

  if (subcommand === 'remove-role') {
    const role = interaction.options.getRole('role', true);
    const reason = interaction.options.getString('reason') || null;
    const reward = await rewardRoleService.removeReward(
      interaction.guild.id,
      role.id,
      interaction.user.id,
      reason
    );

    if (!reward) return 'That role was not an active level reward.';
    return `Reward role ${role} has been removed from automation.`;
  }

  if (subcommand === 'list') {
    const rewards = await rewardRoleService.listRewards(interaction.guild.id);
    if (rewards.length === 0) return 'No active level reward roles are configured.';

    return rewards
      .map(reward => `Level ${reward.required_level}: <@&${reward.role_id}>`)
      .join('\n');
  }

  if (subcommand === 'sync-user') {
    const user = interaction.options.getUser('user', true);
    const row = await userRepository.ensureUser(interaction.guild.id, user.id);
    const result = await rewardRoleService.syncMemberRewards(
      interaction.client,
      interaction.guild.id,
      user.id,
      Number(row.level)
    );

    return `Synced ${user}. Assigned ${result.assigned.length}, removed ${result.removed.length}, skipped ${result.skipped.length}.`;
  }

  return 'Unknown rewards config action.';
}

async function handleTickets(interaction) {
  const subcommand = interaction.options.getSubcommand();
  await ticketSettingsService.ensureGuildSettings(interaction.guild.id);

  if (subcommand === 'category') {
    const channel = interaction.options.getChannel('category', true);
    await ticketSettingsService.updateSettings(interaction.guild.id, {
      category_channel_id: channel.id
    });
    return `Tickets will now be created under ${channel}.`;
  }

  if (subcommand === 'log-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await ticketSettingsService.updateSettings(interaction.guild.id, {
      log_channel_id: channel.id
    });
    return `Ticket logs will now use ${channel}.`;
  }

  if (subcommand === 'support-role') {
    const role = interaction.options.getRole('role', true);
    await ticketSettingsService.updateSettings(interaction.guild.id, {
      support_role_id: role.id
    });
    return `Ticket staff pings and access will use ${role}.`;
  }

  if (subcommand === 'enabled') {
    const enabled = interaction.options.getBoolean('enabled', true);
    await ticketSettingsService.updateSettings(interaction.guild.id, {
      tickets_enabled: enabled
    });
    return `Tickets are now ${enabled ? 'enabled' : 'disabled'}.`;
  }

  return 'Unknown ticket config action.';
}

async function execute(interaction) {
  assertManageGuild(interaction);

  const group = interaction.options.getSubcommandGroup();

  if (group === 'welcome') return handleWelcome(interaction);
  if (group === 'leveling') return handleLeveling(interaction);
  if (group === 'gallery') return handleGallery(interaction);
  if (group === 'rewards') return handleRewards(interaction);
  if (group === 'tickets') return handleTickets(interaction);

  return 'Unknown config group.';
}

module.exports = {
  execute,
  assertManageGuild
};
