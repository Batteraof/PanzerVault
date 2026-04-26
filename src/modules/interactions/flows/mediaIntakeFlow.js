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
const customIds = require('../../../lib/customIds');
const mediaSubmissionRepository = require('../../../db/repositories/mediaSubmissionRepository');
const mediaIntakeService = require('../../media/services/mediaIntakeService');
const mediaTagService = require('../../media/services/mediaTagService');
const logger = require('../../../logger');

const DRAFT_TTL_MS = 15 * 60 * 1000;
const drafts = new Map();

function owns(customIdValue) {
  return String(customIdValue || '').startsWith(`${customIds.MEDIA_INTAKE_PREFIX}:`);
}

function customId(action, submissionId) {
  return `${customIds.MEDIA_INTAKE_PREFIX}:${action}:${submissionId}`;
}

function parse(customIdValue) {
  const [, action, submissionId] = String(customIdValue || '').split(':');
  return {
    action,
    submissionId: submissionId ? Number(submissionId) : null
  };
}

function cleanupDrafts() {
  const now = Date.now();
  for (const [draftKey, draft] of drafts.entries()) {
    if (draft.expiresAt <= now) drafts.delete(draftKey);
  }
}

function buildDetailsModal(submission, draft = null) {
  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Title')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(120)
    .setPlaceholder('Give this post a short title.');

  const tagsInput = new TextInputBuilder()
    .setCustomId('tags')
    .setLabel('Tags')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(180)
    .setPlaceholder('Comma separated tags, for example: stuck tank, snowy flank');

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(300)
    .setPlaceholder('Optional extra context for viewers.');

  if (draft?.title || submission.title) {
    titleInput.setValue(draft?.title || submission.title);
  }

  if (draft?.rawTagsInput) {
    tagsInput.setValue(draft.rawTagsInput);
  }

  if (draft?.description || submission.description) {
    descriptionInput.setValue(draft?.description || submission.description);
  }

  return new ModalBuilder()
    .setCustomId(customId('details_modal', submission.id))
    .setTitle('Add media details')
    .addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(tagsInput),
      new ActionRowBuilder().addComponents(descriptionInput)
    );
}

function formatSuggestionLines(draft) {
  if (!draft.suggestions.length) return 'No close matches found.';

  return draft.suggestions
    .map(suggestion => `\`${suggestion.typedName}\` -> \`${suggestion.suggestedTag.tag_name}\``)
    .join('\n');
}

function buildDraftPayload(draft, notice = null) {
  const finalTags = mediaTagService.resolveDraftTags(draft);
  const embed = new EmbedBuilder()
    .setColor(draft.suggestions.length ? 0xf59e0b : 0x5865f2)
    .setTitle('Media details draft')
    .setDescription(draft.description || 'No description provided.')
    .addFields(
      {
        name: 'Title',
        value: draft.title,
        inline: false
      },
      {
        name: 'Detected media',
        value: draft.mediaLabel,
        inline: true
      },
      {
        name: 'Final tags preview',
        value: mediaTagService.formatTagList(finalTags),
        inline: true
      }
    )
    .setFooter({ text: 'Save when the tags look right.' })
    .setTimestamp(new Date(draft.createdAt));

  if (draft.suggestions.length) {
    embed.addFields(
      {
        name: 'Did you mean these existing tags?',
        value: formatSuggestionLines(draft),
        inline: false
      },
      {
        name: 'Current suggestion mode',
        value: draft.useSuggestedTags
          ? 'Using the suggested existing tags.'
          : 'Keeping your typed versions as new tags.',
        inline: false
      }
    );
  }

  const components = [];

  if (draft.knownTagOptions.length) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(customId('existing_tags', draft.submissionId))
          .setPlaceholder(
            draft.selectedExistingNormalized.length
              ? `${draft.selectedExistingNormalized.length} extra existing tag(s) selected`
              : 'Optionally click existing tags to add them'
          )
          .setMinValues(0)
          .setMaxValues(Math.min(10, draft.knownTagOptions.length))
          .addOptions(
            draft.knownTagOptions.map(option => ({
              ...option,
              default: draft.selectedExistingNormalized.includes(option.value)
            }))
          )
      )
    );
  }

  const buttons = [];

  if (draft.suggestions.length) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(customId('use_suggestions', draft.submissionId))
        .setLabel('Use suggestions')
        .setStyle(draft.useSuggestedTags ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(customId('keep_typed', draft.submissionId))
        .setLabel('Keep typed tags')
        .setStyle(draft.useSuggestedTags ? ButtonStyle.Secondary : ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(customId('save', draft.submissionId))
      .setLabel('Save details')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(customId('cancel', draft.submissionId))
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
  );

  components.push(new ActionRowBuilder().addComponents(buttons));

  return {
    content: notice || 'Review the tags, reuse any existing ones you want, then save.',
    embeds: [embed],
    components
  };
}

async function replyOwnershipError(interaction) {
  await interaction.reply({
    content: 'This media prompt belongs to someone else.',
    flags: MessageFlags.Ephemeral
  }).catch(() => null);
}

async function getSubmission(interaction, submissionId) {
  if (!submissionId) {
    await interaction.reply({
      content: 'That media prompt is no longer valid.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  const submission = await mediaSubmissionRepository.findById(submissionId);
  if (!submission || submission.guild_id !== interaction.guildId) {
    await interaction.reply({
      content: 'That media prompt expired or belongs to another server.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  if (submission.user_id !== interaction.user.id) {
    await replyOwnershipError(interaction);
    return null;
  }

  return submission;
}

function getDraftKey(submissionId) {
  return String(submissionId);
}

function getDraft(submissionId) {
  cleanupDrafts();
  return drafts.get(getDraftKey(submissionId)) || null;
}

function saveDraft(draft) {
  draft.expiresAt = Date.now() + DRAFT_TTL_MS;
  drafts.set(getDraftKey(draft.submissionId), draft);
}

async function handleDetails(interaction, parsed) {
  const submission = await getSubmission(interaction, parsed.submissionId);
  if (!submission) return true;

  if (submission.status === 'completed') {
    await interaction.reply({
      content: 'Details were already saved for this post.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return true;
  }

  if (submission.status === 'dismissed') {
    await interaction.reply({
      content: 'This prompt was dismissed. Post again if you want a new media prompt.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return true;
  }

  const draft = getDraft(submission.id);
  await interaction.showModal(buildDetailsModal(submission, draft));
  return true;
}

async function handleDetailsModal(interaction, parsed) {
  const submission = await getSubmission(interaction, parsed.submissionId);
  if (!submission) return true;

  try {
    const prepared = await mediaTagService.prepareTagDraft(
      interaction.guildId,
      interaction.fields.getTextInputValue('tags').trim()
    );

    const draft = {
      submissionId: submission.id,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      title: interaction.fields.getTextInputValue('title').trim(),
      description: interaction.fields.getTextInputValue('description').trim(),
      rawTagsInput: prepared.rawInput,
      exactTags: prepared.exactTags,
      newTags: prepared.newTags,
      suggestions: prepared.suggestions,
      knownTags: prepared.knownTags,
      knownTagOptions: prepared.knownTagOptions,
      selectedExistingNormalized: [],
      useSuggestedTags: false,
      mediaLabel: mediaIntakeService.MEDIA_KIND_LABELS[submission.media_kind] || 'Media',
      createdAt: Date.now(),
      expiresAt: Date.now() + DRAFT_TTL_MS
    };

    saveDraft(draft);
    await interaction.reply({
      ...buildDraftPayload(draft),
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    await interaction.reply({
      content: error.message || 'Could not prepare those tags.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
  }

  return true;
}

async function resolveDraftForInteraction(interaction, submissionId) {
  const submission = await getSubmission(interaction, submissionId);
  if (!submission) return { submission: null, draft: null };

  const draft = getDraft(submissionId);
  if (!draft) {
    await interaction.reply({
      content: 'That media details draft expired. Click **Add details** under the original post again.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return { submission, draft: null };
  }

  saveDraft(draft);
  return { submission, draft };
}

async function handleExistingTags(interaction, parsed) {
  const { draft } = await resolveDraftForInteraction(interaction, parsed.submissionId);
  if (!draft) return true;

  draft.selectedExistingNormalized = interaction.values || [];
  saveDraft(draft);
  await interaction.update(buildDraftPayload(draft));
  return true;
}

async function handleUseSuggestions(interaction, parsed, useSuggestedTags) {
  const { draft } = await resolveDraftForInteraction(interaction, parsed.submissionId);
  if (!draft) return true;

  draft.useSuggestedTags = useSuggestedTags;
  saveDraft(draft);
  await interaction.update(buildDraftPayload(draft));
  return true;
}

async function handleSave(interaction, parsed) {
  const { submission, draft } = await resolveDraftForInteraction(interaction, parsed.submissionId);
  if (!submission || !draft) return true;

  const resolvedTags = mediaTagService.resolveDraftTags(draft);
  if (!resolvedTags.length) {
    await interaction.update(buildDraftPayload(draft, 'Add or keep at least one tag before saving.'));
    return true;
  }

  await interaction.update({
    ...buildDraftPayload(draft, 'Saving your media details...'),
    components: []
  });

  try {
    await mediaIntakeService.completeSubmission(interaction.client, submission.id, interaction.user.id, {
      title: draft.title,
      description: draft.description,
      tags: resolvedTags
    });

    drafts.delete(getDraftKey(submission.id));
    await interaction.editReply({
      content: 'Saved. Your tags are now reusable for the next media post too.',
      embeds: [],
      components: []
    });
  } catch (error) {
    logger.warn('Failed to save media details', error);
    await interaction.editReply(buildDraftPayload(draft, error.message || 'Could not save that media post right now.'));
  }

  return true;
}

async function handleCancel(interaction, parsed) {
  const { draft } = await resolveDraftForInteraction(interaction, parsed.submissionId);
  if (!draft) return true;

  drafts.delete(getDraftKey(parsed.submissionId));
  await interaction.update({
    content: 'Media details cancelled. You can still use the button under the original post later.',
    embeds: [],
    components: []
  });
  return true;
}

async function handleDismiss(interaction, parsed) {
  const submission = await getSubmission(interaction, parsed.submissionId);
  if (!submission) return true;

  await mediaIntakeService.dismissSubmission(interaction.client, submission.id);
  drafts.delete(getDraftKey(submission.id));
  await interaction.update(mediaIntakeService.buildDismissedPayload());
  return true;
}

async function handle(interaction) {
  const parsed = parse(interaction.customId);
  if (!parsed.action) return false;

  if (parsed.action === 'details') return handleDetails(interaction, parsed);
  if (parsed.action === 'details_modal') return handleDetailsModal(interaction, parsed);
  if (parsed.action === 'existing_tags') return handleExistingTags(interaction, parsed);
  if (parsed.action === 'use_suggestions') return handleUseSuggestions(interaction, parsed, true);
  if (parsed.action === 'keep_typed') return handleUseSuggestions(interaction, parsed, false);
  if (parsed.action === 'save') return handleSave(interaction, parsed);
  if (parsed.action === 'cancel') return handleCancel(interaction, parsed);
  if (parsed.action === 'dismiss') return handleDismiss(interaction, parsed);

  return false;
}

module.exports = {
  owns,
  handle
};