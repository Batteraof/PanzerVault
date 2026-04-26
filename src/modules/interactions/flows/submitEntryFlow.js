const { randomUUID } = require('node:crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const customIds = require('../../../lib/customIds');
const galleryValidationService = require('../../gallery/services/galleryValidationService');
const galleryWizardService = require('../../gallery/services/galleryWizardService');
const videoSubmitFlow = require('./videoSubmitFlow');
const { GalleryUserError } = require('../../gallery/utils/galleryErrors');
const logger = require('../../../logger');

const DRAFT_TTL_MS = 15 * 60 * 1000;
const drafts = new Map();

function createDraftId() {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function flowCustomId(action, draftId) {
  return `${customIds.SUBMIT_FLOW_PREFIX}:${action}:${draftId}`;
}

function parse(customIdValue) {
  const [prefix, action, draftId] = String(customIdValue || '').split(':');
  if (prefix !== customIds.SUBMIT_FLOW_PREFIX) return null;
  return { action, draftId };
}

function owns(customIdValue) {
  return Boolean(parse(customIdValue));
}

function cleanupDrafts() {
  const now = Date.now();
  for (const [draftId, draft] of drafts.entries()) {
    if (draft.expiresAt <= now) drafts.delete(draftId);
  }
}

function buildChoicePayload(draft, notice = null) {
  const galleryReady = draft.assets.length > 0;
  const galleryStatus = galleryReady
    ? `${draft.assets.length} image${draft.assets.length === 1 ? '' : 's'} attached and ready to use.`
    : 'No images attached yet. Discord pop-up forms still cannot upload files, so gallery posts need 1-5 PNG or JPG images attached to /submit first.';

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Start a Submission')
    .setDescription('Choose whether you are posting a gallery entry or a YouTube video. The rest of the flow stays guided and private.')
    .addFields(
      {
        name: 'Gallery',
        value: `${galleryStatus}\nAfter that, category, tags, description, and the final post all stay in the guided wizard.`,
        inline: false
      },
      {
        name: 'Video',
        value: 'No file upload needed. You will get a clean form for title, YouTube link, description, and tags.',
        inline: false
      }
    )
    .setFooter({ text: 'Submission drafts expire after about 15 minutes.' })
    .setTimestamp(new Date(draft.createdAt));

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(flowCustomId('gallery', draft.id))
        .setLabel('Gallery')
        .setStyle(galleryReady ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(flowCustomId('video', draft.id))
        .setLabel('Video')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(flowCustomId('cancel', draft.id))
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    )
  ];

  return {
    content: notice || 'Choose what you want to share.',
    embeds: [embed],
    components
  };
}

async function resolveDraft(interaction, draftId) {
  cleanupDrafts();
  const draft = drafts.get(draftId);

  if (!draft) {
    await interaction.reply({
      content: 'That submit draft expired. Run `/submit` again.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  if (draft.userId !== interaction.user.id || draft.guildId !== interaction.guildId) {
    await interaction.reply({
      content: 'That submit draft belongs to someone else.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return null;
  }

  draft.expiresAt = Date.now() + DRAFT_TTL_MS;
  return draft;
}

async function start(interaction) {
  const draft = {
    id: createDraftId(),
    guildId: interaction.guildId,
    userId: interaction.user.id,
    sourceRef: interaction.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + DRAFT_TTL_MS,
    assets: galleryValidationService.getAttachmentOptions(interaction)
  };

  drafts.set(draft.id, draft);
  await interaction.editReply(buildChoicePayload(draft));
}

async function handleGallery(interaction, draft) {
  if (!draft.assets.length) {
    await interaction.update(
      buildChoicePayload(
        draft,
        'Gallery posts still need 1-5 PNG or JPG images attached to `/submit`. Discord pop-up forms cannot upload files yet, so rerun `/submit` with your images attached, then choose Gallery.'
      )
    );
    return true;
  }

  try {
    await galleryWizardService.startFromAssets(interaction, draft.assets, {
      sourceRef: draft.sourceRef,
      transport: 'update'
    });
    drafts.delete(draft.id);
  } catch (error) {
    if (error instanceof GalleryUserError || error.isGalleryUserError) {
      await interaction.update(buildChoicePayload(draft, error.message));
      return true;
    }

    logger.error('Unified submit gallery launch failed', error);
    await interaction.update(buildChoicePayload(draft, 'Something went wrong while opening the gallery wizard.'));
  }

  return true;
}

async function handleVideo(interaction, draft) {
  await videoSubmitFlow.showModal(interaction);
  drafts.delete(draft.id);
  return true;
}

async function handleCancel(interaction, draft) {
  drafts.delete(draft.id);
  await interaction.update({
    content: 'Submission draft cancelled.',
    embeds: [],
    components: []
  });
  return true;
}

async function handle(interaction) {
  const parsed = parse(interaction.customId);
  if (!parsed) return false;

  const draft = await resolveDraft(interaction, parsed.draftId);
  if (!draft) return true;

  if (parsed.action === 'gallery') return handleGallery(interaction, draft);
  if (parsed.action === 'video') return handleVideo(interaction, draft);
  if (parsed.action === 'cancel') return handleCancel(interaction, draft);

  await interaction.reply({
    content: 'That submit action is no longer active. Run `/submit` again.',
    flags: MessageFlags.Ephemeral
  }).catch(() => null);
  return true;
}

module.exports = {
  owns,
  start,
  handle
};