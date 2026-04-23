const { randomUUID } = require('node:crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionWebhook,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const galleryService = require('./galleryService');
const gallerySettingsService = require('./gallerySettingsService');
const galleryTagService = require('./galleryTagService');
const galleryValidationService = require('./galleryValidationService');
const {
  CATEGORIES,
  CATEGORY_LABELS,
  MAX_CAPTION_LENGTH
} = require('../constants/galleryConfig');
const { GalleryUserError } = require('../utils/galleryErrors');
const customIds = require('../../../lib/customIds');
const logger = require('../../../logger');

const WIZARD_TTL_MS = 15 * 60 * 1000;
const TAG_MENU_OPTION_LIMIT = 25;
const drafts = new Map();

function createDraftId() {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function buildCustomId(base, draftId, value = null) {
  return value ? `${base}:${draftId}:${value}` : `${base}:${draftId}`;
}

function parseCustomId(customId) {
  const parts = String(customId || '').split(':');
  if (parts[0] !== customIds.GALLERY_WIZARD_PREFIX) return null;

  return {
    action: parts[1] || null,
    draftId: parts[2] || null,
    value: parts.slice(3).join(':') || null
  };
}

function categoryAvailability(settings) {
  return {
    [CATEGORIES.SHOWCASE]: Boolean(settings.showcase_channel_id),
    [CATEGORIES.MEME]: Boolean(settings.meme_channel_id)
  };
}

function hasAnyGalleryCategory(settings) {
  const availability = categoryAvailability(settings);
  return availability[CATEGORIES.SHOWCASE] || availability[CATEGORIES.MEME];
}

function clearDraftTimer(draft) {
  if (draft.timeout) {
    clearTimeout(draft.timeout);
    draft.timeout = null;
  }
}

function destroyDraft(draftId) {
  const draft = drafts.get(draftId);
  if (!draft) return;

  clearDraftTimer(draft);
  drafts.delete(draftId);
}

function scheduleDraftExpiry(draft) {
  clearDraftTimer(draft);
  const delay = Math.max(draft.expiresAt - Date.now(), 0);

  draft.timeout = setTimeout(() => {
    drafts.delete(draft.id);
  }, delay);
}

function refreshDraftExpiry(draft) {
  scheduleDraftExpiry(draft);
}

function cleanupExpiredDrafts() {
  const now = Date.now();

  for (const [draftId, draft] of drafts.entries()) {
    if (draft.expiresAt <= now) {
      destroyDraft(draftId);
    }
  }
}

async function editOriginalDraftMessage(client, draft, payload) {
  const webhook = new InteractionWebhook(client, draft.applicationId, draft.token);
  return webhook.editMessage('@original', payload);
}

function selectedTagText(selectedTags) {
  if (!selectedTags.length) return 'None selected';
  return selectedTags.map(tag => `\`${tag.label}\``).join(' ');
}

function draftStatusText(draft, settings, hiddenTagCount, busy) {
  if (busy) {
    return 'Posting your gallery submission...';
  }

  if (!draft.category) {
    return 'Choose a category to unlock tags and posting.';
  }

  const destinationChannelId = gallerySettingsService.getTargetChannelId(settings, draft.category);
  if (!destinationChannelId) {
    return 'That category is not configured yet. Pick the other category or ask staff for help.';
  }

  if (hiddenTagCount > 0) {
    return `Ready to post. Showing the first ${TAG_MENU_OPTION_LIMIT} approved tags in the picker.`;
  }

  return 'Ready to post when you are.';
}

function draftContent(notice) {
  if (!notice) {
    return 'Use the controls below to finish your gallery post.';
  }

  return `**${notice}**\n\nUse the controls below to finish your gallery post.`;
}

function buildDetailsModal(draft) {
  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(MAX_CAPTION_LENGTH)
    .setPlaceholder('Optional description for your submission.');

  if (draft.caption) {
    descriptionInput.setValue(draft.caption);
  }

  const videoInput = new TextInputBuilder()
    .setCustomId('video_link')
    .setLabel('YouTube Link')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('Optional YouTube URL');

  if (draft.videoLink) {
    videoInput.setValue(draft.videoLink);
  }

  return new ModalBuilder()
    .setCustomId(buildCustomId(customIds.GALLERY_WIZARD_DETAILS_MODAL, draft.id))
    .setTitle('Gallery Details')
    .addComponents(
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(videoInput)
    );
}

async function buildDraftPayload(draft, options = {}) {
  const settings = options.settings || await gallerySettingsService.ensureGuildSettings(draft.guildId);
  const availability = categoryAvailability(settings);
  const destinationChannelId = draft.category
    ? gallerySettingsService.getTargetChannelId(settings, draft.category)
    : null;

  let availableTags = [];
  if (draft.category) {
    availableTags = await galleryTagService.listTags(draft.guildId, draft.category);
  }

  const tagMap = new Map(availableTags.map(tag => [
    tag.normalized_name,
    {
      value: tag.normalized_name,
      label: tag.tag_name
    }
  ]));

  draft.selectedTags = draft.selectedTags
    .filter(tag => tagMap.has(tag.value))
    .map(tag => tagMap.get(tag.value));

  const visibleTags = availableTags
    .slice()
    .sort((left, right) => left.tag_name.localeCompare(right.tag_name))
    .slice(0, TAG_MENU_OPTION_LIMIT);
  const hiddenTagCount = Math.max(availableTags.length - visibleTags.length, 0);

  const embed = new EmbedBuilder()
    .setColor(options.busy ? 0xf59e0b : 0x5865f2)
    .setTitle('Gallery Submission Draft')
    .setDescription('Upload your images with `/submit`, then finish the rest here without fighting the slash command bar.')
    .addFields(
      {
        name: 'Images',
        value: `${draft.assets.length} uploaded\n${draft.assets.map(asset => `- ${asset.filename}`).join('\n')}`,
        inline: false
      },
      {
        name: 'Category',
        value: draft.category ? CATEGORY_LABELS[draft.category] : 'Not selected yet',
        inline: true
      },
      {
        name: 'Destination',
        value: destinationChannelId
          ? `<#${destinationChannelId}>`
          : draft.category
            ? 'No gallery channel is configured for this category yet'
            : 'Choose a category first',
        inline: true
      },
      {
        name: 'Tags',
        value: selectedTagText(draft.selectedTags),
        inline: false
      },
      {
        name: 'Description',
        value: draft.caption || 'None yet',
        inline: false
      },
      {
        name: 'YouTube',
        value: draft.videoLink || 'None',
        inline: false
      },
      {
        name: 'Status',
        value: draftStatusText(draft, settings, hiddenTagCount, options.busy),
        inline: false
      }
    )
    .setFooter({ text: 'Drafts expire after about 15 minutes.' })
    .setTimestamp(new Date(draft.createdAt));

  if (draft.assets[0]) {
    embed.setImage(draft.assets[0].url);
  }

  const categoryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId(customIds.GALLERY_WIZARD_CATEGORY, draft.id, CATEGORIES.SHOWCASE))
      .setLabel('Showcase')
      .setStyle(draft.category === CATEGORIES.SHOWCASE ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(options.busy || !availability[CATEGORIES.SHOWCASE]),
    new ButtonBuilder()
      .setCustomId(buildCustomId(customIds.GALLERY_WIZARD_CATEGORY, draft.id, CATEGORIES.MEME))
      .setLabel('Meme')
      .setStyle(draft.category === CATEGORIES.MEME ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(options.busy || !availability[CATEGORIES.MEME])
  );

  const tagMenu = new StringSelectMenuBuilder()
    .setCustomId(buildCustomId(customIds.GALLERY_WIZARD_TAGS, draft.id))
    .setPlaceholder(
      !draft.category
        ? 'Pick a category first'
        : visibleTags.length === 0
          ? 'No approved tags available'
          : draft.selectedTags.length
            ? `${draft.selectedTags.length} tag(s) selected`
            : 'Choose approved tags (optional)'
    );

  if (!draft.category) {
    tagMenu
      .addOptions([{ label: 'Pick a category first', value: '__waiting_category' }])
      .setDisabled(true);
  } else if (visibleTags.length === 0) {
    tagMenu
      .addOptions([{ label: 'No approved tags available', value: '__no_tags' }])
      .setDisabled(true);
  } else {
    tagMenu
      .addOptions(
        visibleTags.map(tag => ({
          label: tag.tag_name,
          value: tag.normalized_name,
          default: draft.selectedTags.some(selected => selected.value === tag.normalized_name)
        }))
      )
      .setMinValues(0)
      .setMaxValues(visibleTags.length)
      .setDisabled(Boolean(options.busy));
  }

  const tagsRow = new ActionRowBuilder().addComponents(tagMenu);
  const readyToPost = Boolean(draft.category && destinationChannelId && !options.busy);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId(customIds.GALLERY_WIZARD_DETAILS, draft.id))
      .setLabel(draft.caption || draft.videoLink ? 'Edit Details' : 'Add Details')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(Boolean(options.busy)),
    new ButtonBuilder()
      .setCustomId(buildCustomId(customIds.GALLERY_WIZARD_CLEAR_TAGS, draft.id))
      .setLabel('Clear Tags')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(Boolean(options.busy) || draft.selectedTags.length === 0),
    new ButtonBuilder()
      .setCustomId(buildCustomId(customIds.GALLERY_WIZARD_POST, draft.id))
      .setLabel('Post')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!readyToPost),
    new ButtonBuilder()
      .setCustomId(buildCustomId(customIds.GALLERY_WIZARD_CANCEL, draft.id))
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(Boolean(options.busy))
  );

  return {
    content: draftContent(options.notice),
    embeds: [embed],
    components: [categoryRow, tagsRow, actionRow]
  };
}

function buildSuccessPayload(result) {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle('Gallery Submission Posted')
    .setDescription(`Submission #${result.submission.id} is now live in <#${result.message.channel.id}>.`)
    .addFields(
      {
        name: 'Public Post',
        value: `[Open message](${result.message.url})`,
        inline: true
      },
      {
        name: 'Submission ID',
        value: String(result.submission.id),
        inline: true
      }
    )
    .setFooter({ text: 'Thanks for contributing to the gallery.' })
    .setTimestamp();

  return {
    content: 'Your gallery post is live.',
    embeds: [embed],
    components: []
  };
}

function buildCancelledPayload() {
  return {
    content: 'Submission draft cancelled.',
    embeds: [],
    components: []
  };
}

async function resolveDraft(interaction, parsed) {
  cleanupExpiredDrafts();

  const draft = drafts.get(parsed.draftId);
  if (!draft) {
    const expiredPayload = {
      content: 'This submission draft expired. Run `/submit` again with your images.',
      embeds: [],
      components: []
    };

    if (typeof interaction.update === 'function') {
      await interaction.update(expiredPayload).catch(async () => {
        await interaction.reply({ content: expiredPayload.content, ephemeral: true }).catch(() => null);
      });
    } else {
      await interaction.reply({ content: expiredPayload.content, ephemeral: true }).catch(() => null);
    }

    return null;
  }

  if (draft.userId !== interaction.user.id || draft.guildId !== interaction.guildId) {
    await interaction.reply({
      content: 'That draft belongs to someone else.',
      ephemeral: true
    }).catch(() => null);
    return null;
  }

  refreshDraftExpiry(draft);
  return draft;
}

async function handleCategory(interaction, draft, category) {
  const settings = await gallerySettingsService.ensureGuildSettings(draft.guildId);
  const availability = categoryAvailability(settings);

  if (!availability[category]) {
    await interaction.reply({
      content: 'That gallery category is not configured yet.',
      ephemeral: true
    }).catch(() => null);
    return true;
  }

  draft.category = category;
  const payload = await buildDraftPayload(draft, { settings });
  await interaction.update(payload);
  return true;
}

async function handleTags(interaction, draft) {
  if (!draft.category) {
    await interaction.reply({
      content: 'Pick a category first so I can load the right approved tags.',
      ephemeral: true
    }).catch(() => null);
    return true;
  }

  const availableTags = await galleryTagService.listTags(draft.guildId, draft.category);
  const byValue = new Map(availableTags.map(tag => [
    tag.normalized_name,
    {
      value: tag.normalized_name,
      label: tag.tag_name
    }
  ]));

  draft.selectedTags = interaction.values
    .filter(value => byValue.has(value))
    .map(value => byValue.get(value));

  const payload = await buildDraftPayload(draft);
  await interaction.update(payload);
  return true;
}

async function handleDetails(interaction, draft) {
  await interaction.showModal(buildDetailsModal(draft));
  return true;
}

async function handleDetailsModal(interaction, draft) {
  try {
    draft.caption = galleryValidationService.validateCaption(interaction.fields.getTextInputValue('description'));
    draft.videoLink = galleryValidationService.validateVideoLink(interaction.fields.getTextInputValue('video_link'));
  } catch (error) {
    if (error instanceof GalleryUserError || error.isGalleryUserError) {
      await interaction.reply({
        content: error.message,
        ephemeral: true
      }).catch(() => null);
      return true;
    }

    throw error;
  }

  const payload = await buildDraftPayload(draft);

  if (typeof interaction.update === 'function' && interaction.isFromMessage && interaction.isFromMessage()) {
    await interaction.update(payload);
  } else {
    await interaction.reply({
      content: 'Details saved.',
      ephemeral: true
    }).catch(() => null);
    await editOriginalDraftMessage(interaction.client, draft, payload);
  }

  return true;
}

async function handleClearTags(interaction, draft) {
  draft.selectedTags = [];
  const payload = await buildDraftPayload(draft);
  await interaction.update(payload);
  return true;
}

async function handleCancel(interaction, draft) {
  destroyDraft(draft.id);
  await interaction.update(buildCancelledPayload());
  return true;
}

async function handlePost(interaction, draft) {
  if (!draft.category) {
    await interaction.reply({
      content: 'Choose a category before posting.',
      ephemeral: true
    }).catch(() => null);
    return true;
  }

  const processingPayload = await buildDraftPayload(draft, {
    busy: true,
    notice: 'Posting your submission now...'
  });

  await interaction.update(processingPayload);

  try {
    const result = await galleryService.submitPrepared(
      interaction,
      {
        category: draft.category,
        assets: draft.assets,
        caption: draft.caption || '',
        videoLink: draft.videoLink || '',
        tagsInput: draft.selectedTags.map(tag => tag.label).join(', ')
      },
      {
        sourceRef: draft.sourceRef
      }
    );

    destroyDraft(draft.id);
    await editOriginalDraftMessage(interaction.client, draft, buildSuccessPayload(result));
  } catch (error) {
    const notice = error instanceof GalleryUserError || error.isGalleryUserError
      ? error.message
      : 'Something went wrong while posting your submission.';

    if (!(error instanceof GalleryUserError || error.isGalleryUserError)) {
      logger.error('Gallery wizard post failed', error);
    }

    await editOriginalDraftMessage(
      interaction.client,
      draft,
      await buildDraftPayload(draft, { notice })
    );
  }

  return true;
}

async function start(interaction) {
  if (!interaction.guild) {
    throw new GalleryUserError('Gallery submissions can only be used in a server.');
  }

  const settings = await galleryService.ensureGuildGallerySetup(interaction.guild.id);
  if (!settings.gallery_enabled) {
    throw new GalleryUserError('The gallery is currently disabled.');
  }

  if (!hasAnyGalleryCategory(settings)) {
    throw new GalleryUserError('Gallery channels are not configured yet. Ask staff to set the showcase and meme channels first.');
  }

  const assets = galleryValidationService.getAttachmentOptions(interaction);
  galleryValidationService.validateAttachments(assets);

  const draft = {
    id: createDraftId(),
    sourceRef: interaction.id,
    guildId: interaction.guildId,
    userId: interaction.user.id,
    applicationId: interaction.applicationId,
    token: interaction.token,
    createdAt: Date.now(),
    expiresAt: Date.now() + WIZARD_TTL_MS,
    assets,
    category: null,
    caption: null,
    videoLink: null,
    selectedTags: [],
    timeout: null
  };

  drafts.set(draft.id, draft);
  scheduleDraftExpiry(draft);

  await interaction.editReply(await buildDraftPayload(draft, { settings }));
}

function isWizardInteraction(interaction) {
  return Boolean(parseCustomId(interaction.customId));
}

async function handleInteraction(interaction) {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) return false;

  const draft = await resolveDraft(interaction, parsed);
  if (!draft) return true;

  switch (parsed.action) {
    case 'category':
      return handleCategory(interaction, draft, parsed.value);
    case 'tags':
      return handleTags(interaction, draft);
    case 'details':
      return handleDetails(interaction, draft);
    case 'details_modal':
      return handleDetailsModal(interaction, draft);
    case 'clear_tags':
      return handleClearTags(interaction, draft);
    case 'post':
      return handlePost(interaction, draft);
    case 'cancel':
      return handleCancel(interaction, draft);
    default:
      await interaction.reply({
        content: 'That gallery action is no longer active. Please run `/submit` again.',
        ephemeral: true
      }).catch(() => null);
      return true;
  }
}

module.exports = {
  start,
  isWizardInteraction,
  handleInteraction
};
