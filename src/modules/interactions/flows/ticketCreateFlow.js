const { randomUUID } = require('node:crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const ticketService = require('../../tickets/services/ticketService');

const PREFIX = 'ticket_create';
const drafts = new Map();
const CATEGORY_OPTIONS = [
  { label: 'Support', value: 'support', description: 'General help or account/server questions.' },
  { label: 'Report', value: 'report', description: 'Report an issue, member, or moderation concern.' },
  { label: 'Application', value: 'application', description: 'Apply for roles, staff help, or community positions.' },
  { label: 'Event Issue', value: 'event_issue', description: 'Event scheduling, attendance, or RSVP problems.' }
];

function owns(customId) {
  return String(customId || '').startsWith(`${PREFIX}:`);
}

function createDraftId() {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function customId(action, draftId) {
  return `${PREFIX}:${action}:${draftId}`;
}

function parse(customIdValue) {
  const [, action, draftId] = String(customIdValue || '').split(':');
  return { action, draftId };
}

function buildDetailsModal() {
  return new ModalBuilder()
    .setCustomId(customId('details_modal', 'new'))
    .setTitle('Open Ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('subject')
          .setLabel('Subject')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(120)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('details')
          .setLabel('Details')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000)
      )
    );
}

function buildDraftPayload(draft, notice = null) {
  const embed = new EmbedBuilder()
    .setColor(0x9fb6ff)
    .setTitle('Ticket Draft')
    .setDescription(draft.details || 'No details provided.')
    .addFields(
      { name: 'Subject', value: draft.subject, inline: false },
      { name: 'Category', value: ticketService.CATEGORY_LABELS[draft.category] || 'Not selected', inline: true }
    )
    .setFooter({ text: 'Choose a category, then confirm.' })
    .setTimestamp();

  return {
    content: notice || 'Select the best category so staff can respond faster.',
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(customId('category', draft.id))
          .setPlaceholder('Ticket category')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(CATEGORY_OPTIONS.map(option => ({
            ...option,
            default: option.value === draft.category
          })))
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customId('confirm', draft.id))
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!draft.category),
        new ButtonBuilder()
          .setCustomId(customId('cancel', draft.id))
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

async function start(interaction) {
  await interaction.showModal(buildDetailsModal());
}

async function handleDetailsModal(interaction) {
  const draft = {
    id: createDraftId(),
    guildId: interaction.guildId,
    userId: interaction.user.id,
    subject: interaction.fields.getTextInputValue('subject').trim(),
    details: interaction.fields.getTextInputValue('details').trim(),
    category: null
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
      content: 'That ticket draft expired. Run `/ticket open` again.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  if (draft.userId !== interaction.user.id || draft.guildId !== interaction.guildId) {
    await interaction.reply({
      content: 'That ticket draft belongs to someone else.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  return draft;
}

async function handleCategory(interaction, parsed) {
  const draft = await resolveDraft(interaction, parsed.draftId);
  if (!draft) return true;

  draft.category = interaction.values[0];
  await interaction.update(buildDraftPayload(draft));
  return true;
}

async function handleConfirm(interaction, parsed) {
  const draft = await resolveDraft(interaction, parsed.draftId);
  if (!draft) return true;

  await interaction.update({
    ...buildDraftPayload(draft, 'Creating your ticket...'),
    components: []
  });

  try {
    const result = await ticketService.openTicket(interaction, draft.subject, {
      category: draft.category,
      details: draft.details
    });
    drafts.delete(draft.id);
    await interaction.editReply({
      content: `Ticket #${result.ticket.id} is open in ${result.channel}.`,
      embeds: [],
      components: []
    });
  } catch (error) {
    await interaction.editReply({
      ...buildDraftPayload(draft, error.message || 'Could not create that ticket.')
    });
  }

  return true;
}

async function handleCancel(interaction, parsed) {
  const draft = await resolveDraft(interaction, parsed.draftId);
  if (!draft) return true;

  drafts.delete(draft.id);
  await interaction.update({
    content: 'Ticket draft cancelled.',
    embeds: [],
    components: []
  });
  return true;
}

async function handle(interaction) {
  const parsed = parse(interaction.customId);
  if (parsed.action === 'details_modal') return handleDetailsModal(interaction);
  if (parsed.action === 'category') return handleCategory(interaction, parsed);
  if (parsed.action === 'confirm') return handleConfirm(interaction, parsed);
  if (parsed.action === 'cancel') return handleCancel(interaction, parsed);
  return false;
}

module.exports = {
  owns,
  start,
  handle
};
