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
const videoService = require('../../community/services/videoService');
const contentTagService = require('../../content/services/contentTagService');

const PREFIX = 'video_submit';
const DRAFT_TTL_MS = 15 * 60 * 1000;
const drafts = new Map();

function owns(customId) {
  return String(customId || '').startsWith(`${PREFIX}:`);
}

function createDraftId() {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function customId(action, draftId, value = null) {
  return value ? `${PREFIX}:${action}:${draftId}:${value}` : `${PREFIX}:${action}:${draftId}`;
}

function parse(customIdValue) {
  const [, action, draftId, value] = String(customIdValue || '').split(':');
  return { action, draftId, value };
}

function cleanupDrafts() {
  const now = Date.now();
  for (const [draftId, draft] of drafts.entries()) {
    if (draft.expiresAt <= now) drafts.delete(draftId);
  }
}

function buildDetailsModal() {
  return new ModalBuilder()
    .setCustomId(customId('details_modal', 'new'))
    .setTitle('Submit Video')
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
          .setCustomId('url')
          .setLabel('YouTube Link')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(300)
      )
    );
}

function buildDraftPayload(draft, notice = null) {
  const embed = new EmbedBuilder()
    .setColor(0x9fb6ff)
    .setTitle('Video Submission Draft')
    .setDescription(draft.description || 'No description provided.')
    .addFields(
      { name: 'Title', value: draft.title, inline: false },
      { name: 'Link', value: draft.url, inline: false },
      { name: 'Tags', value: contentTagService.tagsToText(draft.tags), inline: false }
    )
    .setFooter({ text: 'Choose tags, then confirm. Draft expires in 15 minutes.' })
    .setTimestamp();

  const rows = Object.entries(contentTagService.getTagGroups()).map(([tagType, group]) =>
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(customId('tag', draft.id, tagType))
        .setPlaceholder(group.placeholder)
        .setMinValues(0)
        .setMaxValues(1)
        .addOptions(contentTagService.getSelectOptions(tagType, draft.tags[tagType]))
    )
  );

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(customId('confirm', draft.id))
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(customId('cancel', draft.id))
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    )
  );

  return {
    content: notice || 'Add tags to help members discover this video.',
    embeds: [embed],
    components: rows
  };
}

async function start(interaction) {
  await interaction.showModal(buildDetailsModal());
}

async function resolveDraft(interaction, draftId) {
  cleanupDrafts();
  const draft = drafts.get(draftId);

  if (!draft) {
    await interaction.reply({
      content: 'That video draft expired. Run `/video` again.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  if (draft.userId !== interaction.user.id || draft.guildId !== interaction.guildId) {
    await interaction.reply({
      content: 'That video draft belongs to someone else.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  draft.expiresAt = Date.now() + DRAFT_TTL_MS;
  return draft;
}

async function handleDetailsModal(interaction) {
  const draft = {
    id: createDraftId(),
    guildId: interaction.guildId,
    userId: interaction.user.id,
    title: interaction.fields.getTextInputValue('title').trim(),
    url: interaction.fields.getTextInputValue('url').trim(),
    description: interaction.fields.getTextInputValue('description').trim(),
    tags: {},
    expiresAt: Date.now() + DRAFT_TTL_MS
  };

  drafts.set(draft.id, draft);
  await interaction.reply({
    ...buildDraftPayload(draft),
    flags: MessageFlags.Ephemeral
  });
  return true;
}

async function handleTag(interaction, parsed) {
  const draft = await resolveDraft(interaction, parsed.draftId);
  if (!draft) return true;

  if (interaction.values.length) {
    draft.tags[parsed.value] = interaction.values[0];
  } else {
    delete draft.tags[parsed.value];
  }

  await interaction.update(buildDraftPayload(draft));
  return true;
}

async function handleConfirm(interaction, parsed) {
  const draft = await resolveDraft(interaction, parsed.draftId);
  if (!draft) return true;

  await interaction.update({
    ...buildDraftPayload(draft, 'Posting your video...'),
    components: []
  });

  try {
    const result = await videoService.submitPrepared(interaction, draft);
    drafts.delete(draft.id);
    const xpText = result.award && result.award.awarded ? ` You earned ${result.award.xpDelta} XP.` : '';
    await interaction.editReply({
      content: `Video #${result.submission.id} is live in <#${result.message.channel.id}>.${xpText}`,
      embeds: [],
      components: []
    });
  } catch (error) {
    await interaction.editReply({
      ...buildDraftPayload(draft, `Error: ${error.message || 'Could not post that video.'}`)
    });
  }

  return true;
}

async function handleCancel(interaction, parsed) {
  const draft = await resolveDraft(interaction, parsed.draftId);
  if (!draft) return true;

  drafts.delete(draft.id);
  await interaction.update({
    content: 'Video draft cancelled.',
    embeds: [],
    components: []
  });
  return true;
}

async function handle(interaction) {
  const parsed = parse(interaction.customId);

  if (parsed.action === 'details_modal') return handleDetailsModal(interaction);
  if (parsed.action === 'tag') return handleTag(interaction, parsed);
  if (parsed.action === 'confirm') return handleConfirm(interaction, parsed);
  if (parsed.action === 'cancel') return handleCancel(interaction, parsed);

  return false;
}

module.exports = {
  owns,
  start,
  handle
};
