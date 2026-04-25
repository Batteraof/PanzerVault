const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const eventService = require('../../community/services/eventService');
const { parseLocalDateTimeString } = require('../../community/utils/dateUtils');

const PREFIX = 'event_create';
const drafts = new Map();

function owns(customId) {
  return String(customId || '').startsWith(`${PREFIX}:`);
}

function customId(action, draftId) {
  return `${PREFIX}:${action}:${draftId}`;
}

function parse(customIdValue) {
  const [, action, draftId] = String(customIdValue || '').split(':');
  return { action, draftId };
}

function buildDetailsModal(userId) {
  return new ModalBuilder()
    .setCustomId(customId('details_modal', userId))
    .setTitle('Create Event')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(120)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('starts_at')
          .setLabel('Start Time')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('YYYY-MM-DD HH:MM')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('duration_minutes')
          .setLabel('Duration Minutes')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('90')
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('link')
          .setLabel('External Link')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      )
    );
}

function buildDraftPayload(draft, notice = null) {
  const timestamp = Math.floor(draft.startsAt.getTime() / 1000);
  const embed = new EmbedBuilder()
    .setColor(0x9fb6ff)
    .setTitle(draft.title)
    .setDescription(draft.description || 'No description provided.')
    .addFields(
      { name: 'Starts', value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`, inline: true },
      { name: 'Duration', value: draft.durationMinutes ? `${draft.durationMinutes} minutes` : 'Not set', inline: true },
      { name: 'XP', value: 'RSVP: 5\nAttendance: 25\nBonuses: enabled', inline: true }
    )
    .setFooter({ text: 'Confirm to publish this event with RSVP and check-in controls.' })
    .setTimestamp();

  if (draft.externalUrl) {
    embed.addFields({ name: 'Link', value: draft.externalUrl, inline: false });
  }

  return {
    content: notice || 'Review the event before publishing.',
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customId('confirm', draft.id))
          .setLabel('Publish')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(customId('cancel', draft.id))
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

async function start(interaction) {
  await interaction.showModal(buildDetailsModal(interaction.user.id));
}

async function handleDetailsModal(interaction) {
  const startsAtInput = interaction.fields.getTextInputValue('starts_at').trim();
  const startsAt = parseLocalDateTimeString(startsAtInput);
  if (!startsAt) {
    await interaction.reply({
      content: 'Use `YYYY-MM-DD HH:MM` for the event time.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const durationInput = interaction.fields.getTextInputValue('duration_minutes').trim();
  const durationMinutes = durationInput ? Math.max(0, Number.parseInt(durationInput, 10)) : null;
  const endsAt = durationMinutes ? new Date(startsAt.getTime() + durationMinutes * 60 * 1000) : null;
  const draft = {
    id: interaction.user.id,
    guildId: interaction.guildId,
    userId: interaction.user.id,
    title: interaction.fields.getTextInputValue('title').trim(),
    startsAt,
    endsAt,
    durationMinutes,
    description: interaction.fields.getTextInputValue('description').trim(),
    externalUrl: interaction.fields.getTextInputValue('link').trim()
  };

  drafts.set(draft.id, draft);
  await interaction.reply({
    ...buildDraftPayload(draft),
    flags: MessageFlags.Ephemeral
  });
  return true;
}

async function resolveDraft(interaction, draftId) {
  const draft = drafts.get(draftId);
  if (!draft) {
    await interaction.reply({
      content: 'That event draft expired. Run `/event create` again.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  if (draft.userId !== interaction.user.id || draft.guildId !== interaction.guildId) {
    await interaction.reply({
      content: 'That event draft belongs to someone else.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  return draft;
}

async function handleConfirm(interaction, parsed) {
  const draft = await resolveDraft(interaction, parsed.draftId);
  if (!draft) return true;

  await interaction.update({
    ...buildDraftPayload(draft, 'Publishing event...'),
    components: []
  });

  try {
    const result = await eventService.createEventPrepared(interaction, {
      ...draft,
      createdBy: interaction.user.id
    });
    drafts.delete(draft.id);
    await interaction.editReply({
      content: `Event #${result.event.id} is live in <#${result.message.channel.id}>.`,
      embeds: [],
      components: []
    });
  } catch (error) {
    await interaction.editReply({
      ...buildDraftPayload(draft, `Error: ${error.message || 'Could not publish that event.'}`)
    });
  }

  return true;
}

async function handleCancel(interaction, parsed) {
  const draft = await resolveDraft(interaction, parsed.draftId);
  if (!draft) return true;

  drafts.delete(draft.id);
  await interaction.update({
    content: 'Event draft cancelled.',
    embeds: [],
    components: []
  });
  return true;
}

async function handle(interaction) {
  const parsed = parse(interaction.customId);
  if (parsed.action === 'details_modal') return handleDetailsModal(interaction);
  if (parsed.action === 'confirm') return handleConfirm(interaction, parsed);
  if (parsed.action === 'cancel') return handleCancel(interaction, parsed);
  return false;
}

module.exports = {
  owns,
  start,
  handle
};
