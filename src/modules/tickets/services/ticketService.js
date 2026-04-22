const {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const db = require('../../../db/client');
const ticketRepository = require('../../../db/repositories/ticketRepository');
const ticketEventRepository = require('../../../db/repositories/ticketEventRepository');
const ticketSettingsRepository = require('../../../db/repositories/ticketSettingsRepository');
const ticketSettingsService = require('./ticketSettingsService');
const ticketLogService = require('./ticketLogService');

class TicketUserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TicketUserError';
    this.isTicketUserError = true;
  }
}

function sanitizeSubject(subject) {
  if (!subject || !subject.trim()) return null;
  return subject.trim().slice(0, 120);
}

function sanitizeChannelPart(value) {
  return String(value || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'user';
}

function assertCanManageTickets(member) {
  if (!member || !member.permissions) return false;
  return (
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

function buildPermissionOverwrites(guild, settings, openerId) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: openerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (settings.support_role_id) {
    overwrites.push({
      id: settings.support_role_id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  if (guild.members.me) {
    overwrites.push({
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels
      ]
    });
  }

  return overwrites;
}

async function createTicketChannel(interaction, ticket, settings) {
  const guild = interaction.guild;
  const name = `ticket-${ticket.id}-${sanitizeChannelPart(interaction.user.username)}`;

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: settings.category_channel_id || null,
    topic: `Ticket #${ticket.id} for ${interaction.user.tag} (${interaction.user.id})`,
    permissionOverwrites: buildPermissionOverwrites(guild, settings, interaction.user.id),
    reason: `Ticket #${ticket.id} opened by ${interaction.user.tag}`
  });
}

async function openTicket(interaction, subjectInput) {
  const settings = await ticketSettingsService.ensureGuildSettings(interaction.guild.id);

  if (!settings.tickets_enabled) {
    throw new TicketUserError('Tickets are currently disabled.');
  }

  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new TicketUserError('I need Manage Channels permission to create ticket channels.');
  }

  const existing = await ticketRepository.findOpenByUser(interaction.guild.id, interaction.user.id);
  if (existing && existing.channel_id) {
    throw new TicketUserError(`You already have an open ticket: <#${existing.channel_id}>.`);
  }

  const subject = sanitizeSubject(subjectInput);
  const ticket = await db.withTransaction(async client => {
    const created = await ticketRepository.createTicket(
      interaction.guild.id,
      interaction.user.id,
      subject,
      client
    );

    await ticketEventRepository.insertEvent(
      {
        guildId: interaction.guild.id,
        ticketId: created.id,
        actorId: interaction.user.id,
        action: 'open',
        metadata: { subject }
      },
      client
    );

    return created;
  }).catch(error => {
    if (error.code === '23505') {
      throw new TicketUserError('You already have an open ticket.');
    }
    throw error;
  });

  let channel;

  try {
    channel = await createTicketChannel(interaction, ticket, settings);
    const updated = await ticketRepository.setTicketChannel(ticket.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Ticket #${ticket.id}`)
      .setDescription(subject || 'Support will be with you shortly.')
      .addFields(
        { name: 'Opened By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Status', value: 'Open', inline: true }
      )
      .setTimestamp();

    await channel.send({
      content: settings.support_role_id ? `<@&${settings.support_role_id}>` : undefined,
      embeds: [embed],
      allowedMentions: settings.support_role_id ? { roles: [settings.support_role_id] } : { parse: [] }
    });

    await ticketLogService.sendTicketLog(
      interaction.client,
      settings,
      'Ticket Opened',
      [
        { name: 'Ticket', value: `#${ticket.id}`, inline: true },
        { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Subject', value: subject || 'No subject provided.', inline: false }
      ],
      0x57F287
    );

    return {
      ticket: updated,
      channel
    };
  } catch (error) {
    await ticketRepository.closeTicket(ticket.id, interaction.client.user.id, `Ticket channel creation failed: ${error.message}`);
    throw error;
  }
}

async function closeTicket(interaction, reasonInput, deleteChannel = false, ticketId = null) {
  const settings = await ticketSettingsService.ensureGuildSettings(interaction.guild.id);
  const reason = reasonInput || 'No reason provided.';
  let ticket = null;

  if (ticketId) {
    ticket = await ticketRepository.findById(interaction.guild.id, ticketId);
    if (ticket && ticket.status !== 'open') ticket = null;
  } else {
    ticket = await ticketRepository.findOpenByChannel(interaction.guild.id, interaction.channel.id);
  }

  if (!ticket) {
    throw new TicketUserError('I could not find an open ticket for this channel or ID.');
  }

  const isOwner = ticket.user_id === interaction.user.id;
  if (!isOwner && !assertCanManageTickets(interaction.member)) {
    throw new TicketUserError('Only the ticket owner or staff can close this ticket.');
  }

  const closed = await db.withTransaction(async client => {
    const updated = await ticketRepository.closeTicket(
      ticket.id,
      interaction.user.id,
      reason,
      client
    );

    if (!updated) return null;

    await ticketEventRepository.insertEvent(
      {
        guildId: interaction.guild.id,
        ticketId: ticket.id,
        actorId: interaction.user.id,
        action: 'close',
        metadata: { reason, deleteChannel }
      },
      client
    );

    return updated;
  });

  if (!closed) {
    throw new TicketUserError('That ticket is already closed.');
  }

  const channel = ticket.channel_id
    ? await interaction.guild.channels.fetch(ticket.channel_id).catch(() => null)
    : null;

  if (channel && channel.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`Ticket #${ticket.id} Closed`)
      .addFields(
        { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);

    if (deleteChannel) {
      await channel.delete(`Ticket #${ticket.id} closed by ${interaction.user.tag}`).catch(() => null);
    } else if (channel.manageable) {
      await channel.permissionOverwrites.edit(ticket.user_id, {
        SendMessages: false
      }).catch(() => null);
      await channel.setName(`closed-ticket-${ticket.id}`).catch(() => null);
    }
  }

  await ticketLogService.sendTicketLog(
    interaction.client,
    settings,
    'Ticket Closed',
    [
      { name: 'Ticket', value: `#${ticket.id}`, inline: true },
      { name: 'User', value: `<@${ticket.user_id}>`, inline: true },
      { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Reason', value: reason, inline: false }
    ],
    0xED4245
  );

  return closed;
}

async function addUser(interaction, targetUser) {
  if (!assertCanManageTickets(interaction.member)) {
    throw new TicketUserError('You need Manage Channels or Manage Server permission to add users to tickets.');
  }

  const ticket = await ticketRepository.findOpenByChannel(interaction.guild.id, interaction.channel.id);
  if (!ticket) {
    throw new TicketUserError('Use this command inside an open ticket channel.');
  }

  await interaction.channel.permissionOverwrites.edit(targetUser.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  });

  await ticketEventRepository.insertEvent({
    guildId: interaction.guild.id,
    ticketId: ticket.id,
    actorId: interaction.user.id,
    action: 'add_user',
    metadata: { userId: targetUser.id }
  });

  return ticket;
}

async function removeUser(interaction, targetUser) {
  if (!assertCanManageTickets(interaction.member)) {
    throw new TicketUserError('You need Manage Channels or Manage Server permission to remove users from tickets.');
  }

  const ticket = await ticketRepository.findOpenByChannel(interaction.guild.id, interaction.channel.id);
  if (!ticket) {
    throw new TicketUserError('Use this command inside an open ticket channel.');
  }

  await interaction.channel.permissionOverwrites.delete(targetUser.id);

  await ticketEventRepository.insertEvent({
    guildId: interaction.guild.id,
    ticketId: ticket.id,
    actorId: interaction.user.id,
    action: 'remove_user',
    metadata: { userId: targetUser.id }
  });

  return ticket;
}

module.exports = {
  TicketUserError,
  openTicket,
  closeTicket,
  addUser,
  removeUser
};
