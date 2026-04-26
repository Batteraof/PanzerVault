const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const config = require('../../../config');
const customIds = require('../../../lib/customIds');
const botSettingsService = require('./botSettingsService');
const communitySettingsService = require('./communitySettingsService');
const guildSettingsRepository = require('../../../db/repositories/guildSettingsRepository');
const gallerySettingsService = require('../../gallery/services/gallerySettingsService');
const { CATEGORY_LABELS, CATEGORIES } = require('../../gallery/constants/galleryConfig');
const logger = require('../../../logger');

const PANEL_MARKERS = {
  rules: 'PanzerVault Rules Panel',
  showcase: 'PanzerVault Showcase Guide',
  meme: 'PanzerVault Meme Guide',
  video: 'PanzerVault Video Guide',
  leveling: 'PanzerVault Leveling Guide'
};

function supportLine() {
  if (config.botInfo.supportChannelId) {
    return `Need help or found a problem? Head to <#${config.botInfo.supportChannelId}>.`;
  }

  if (config.botInfo.contactText) {
    return config.botInfo.contactText;
  }

  if (config.botInfo.ownerName) {
    return `Need help or found a problem? Contact ${config.botInfo.ownerName} or the staff team.`;
  }

  return 'Need help or found a problem? Contact the staff team.';
}

function buildRulesPanel(guild) {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle(`${guild.name} Rules`)
    .setDescription('Read the rules below, then click **I Agree** to unlock the rest of the server.')
    .addFields(
      {
        name: '1. Be Respectful',
        value: 'Treat all members with respect. Harassment, discrimination, or toxic behavior is not tolerated.',
        inline: false
      },
      {
        name: '2. Keep Discussions Civil',
        value: 'Debate is fine. Drama or hostility are not allowed.',
        inline: false
      },
      {
        name: '3. No NSFW Content',
        value: 'This includes images, videos, links, and inappropriate conversations.',
        inline: false
      },
      {
        name: '4. No Advertising or Self-Promotion Spam',
        value: 'Sharing your own content is allowed when it is relevant and not repeatedly reposted. Excessive self-promotion will be removed.',
        inline: false
      },
      {
        name: '5. Absolutely No Active Recruiting',
        value: 'No recruiting for other clans, units, Discord servers, or gaming groups in channels or DMs. Recruiting here results in an immediate ban.',
        inline: false
      },
      {
        name: '6. Respect Staff Decisions',
        value: 'Moderators and admins have the final say. If you disagree, discuss it privately and respectfully.',
        inline: false
      },
      {
        name: '7. Have Fun and Play Fair',
        value: 'We are here to enjoy the game and the community.',
        inline: false
      },
      {
        name: 'After You Agree',
        value: 'You will unlock the full server, choose your skill and region roles, and Medium or Expert players can opt into a coach role so beginners know who to ask for help.',
        inline: false
      },
      {
        name: 'DM Recruiting or Rule Breaking',
        value: 'If someone recruits you in DMs or breaks these rules, send the details to staff.',
        inline: false
      }
    )
    .setFooter({ text: PANEL_MARKERS.rules });

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(customIds.AGREE_RULES)
        .setLabel('I Agree to the Rules')
        .setStyle(ButtonStyle.Success)
    )
  ];

  return { embeds: [embed], components };
}

function buildGalleryGuidePanel(category) {
  const label = CATEGORY_LABELS[category] || 'Gallery';
  const color = category === CATEGORIES.MEME ? 0xFEE75C : 0x5865F2;

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle(`${label} Gallery Guide`)
        .setDescription('This channel is for curated gallery posts only. Use the submit flow from anywhere in the server and the bot will post here for you.')
        .addFields(
          {
            name: 'How to Submit',
            value: `Use \`/submit\`, attach 1-5 PNG/JPG images, choose **Gallery**, then finish the rest in the guided wizard.`,
            inline: false
          },
          {
            name: 'Useful Commands',
            value: '`/submit`\n`/tags`\n`/profile`',
            inline: true
          },
          {
            name: 'What Fits Here',
            value: category === CATEGORIES.MEME
              ? 'Game or community-related memes and humor.'
              : 'Screenshots, tanks, battle moments, and relevant WW2 game creations.',
            inline: true
          },
          {
            name: 'Rules',
            value: 'No GIFs or uploaded videos, no pings, no extremist glorification, no propaganda-style posting, and no hate disguised as historical content.',
            inline: false
          },
          {
            name: 'Notes',
            value: 'Gallery posts do not grant XP. Staff can remove posts that break the rules.',
            inline: false
          }
        )
        .setFooter({ text: category === CATEGORIES.MEME ? PANEL_MARKERS.meme : PANEL_MARKERS.showcase })
    ]
  };
}

function buildLevelingGuidePanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Leveling Guide')
        .setDescription('Leveling is casual, persistent, and shared across text and voice. Your progress is saved in PostgreSQL and survives restarts.')
        .addFields(
          {
            name: 'Commands',
            value: '`/rank`\n`/leaderboard`\n`/profile`',
            inline: true
          },
          {
            name: 'Text XP',
            value: '15 second cooldown.\n1-3 words: 1 XP\n4-5 words: 3 XP\n6-15 words: 8 XP\n16+ words: 12 XP',
            inline: true
          },
          {
            name: 'Voice XP',
            value: '1 XP every 2 eligible minutes.\nNo XP while alone, in AFK, or self-deafened.',
            inline: true
          },
          {
            name: 'Streaks',
            value: 'Any qualifying text or voice activity within 24 hours keeps your streak alive.',
            inline: false
          },
          {
            name: 'Community Extras',
            value: 'This channel can also host join anniversaries, weekly recaps, and milestone updates when they are enabled.',
            inline: false
          },
          {
            name: 'Important',
            value: 'Gallery submissions do not give XP or streak progress.',
            inline: false
          }
        )
        .setFooter({ text: PANEL_MARKERS.leveling })
    ]
  };
}

function buildVideoGuidePanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xeb459e)
        .setTitle('Video Submission Guide')
        .setDescription('Use this channel for curated YouTube posts only. The bot formats the post here and can still drop a short heads-up in the main community chat.')
        .addFields(
          {
            name: 'How to Submit',
            value: 'Use `/submit`, choose **Video**, then fill in the title, YouTube link, description, and tags in the guided flow.',
            inline: false
          },
          {
            name: 'Useful Commands',
            value: '`/submit`\n`/bot`\n`/profile`',
            inline: true
          },
          {
            name: 'Rules',
            value: 'Use YouTube links only, keep descriptions clean, and avoid spam or repeated reposts.',
            inline: true
          },
          {
            name: 'Notes',
            value: 'Video posts do not give XP. Staff can remove posts that do not fit the server.',
            inline: false
          }
        )
        .setFooter({ text: PANEL_MARKERS.video })
    ]
  };
}

async function fetchTextChannel(client, channelId) {
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.messages) return null;
  return channel;
}

function footerTextForMessage(message) {
  return message.embeds?.[0]?.footer?.text || '';
}

async function findExistingPanelMessage(channel, marker, clientUserId) {
  const pinned = await channel.messages.fetchPinned().catch(() => null);
  if (pinned) {
    const pinnedMatch = pinned.find(message =>
      message.author.id === clientUserId && footerTextForMessage(message) === marker
    );
    if (pinnedMatch) return pinnedMatch;
  }

  const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  if (!recent) return null;

  return recent.find(message =>
    message.author.id === clientUserId && footerTextForMessage(message) === marker
  ) || null;
}

async function pinIfPossible(message) {
  if (message.pinned) return;

  const permissions = message.channel.permissionsFor(message.guild.members.me);
  if (!permissions || !permissions.has(PermissionFlagsBits.ManageMessages)) return;

  await message.pin().catch(error => {
    logger.warn('Failed to pin panel message', error);
  });
}

async function upsertPanel(channel, marker, payload, clientUserId) {
  const existing = await findExistingPanelMessage(channel, marker, clientUserId);

  if (existing) {
    const updated = await existing.edit({
      ...payload,
      allowedMentions: { parse: [] }
    });
    await pinIfPossible(updated);
    return updated;
  }

  const message = await channel.send({
    ...payload,
    allowedMentions: { parse: [] }
  });

  await pinIfPossible(message);
  return message;
}

async function refreshGuildPanels(client, guildId) {
  const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const [botSettings, gallerySettings, levelingSettings, communitySettings] = await Promise.all([
    botSettingsService.ensureGuildSettings(guild.id),
    gallerySettingsService.ensureGuildSettings(guild.id),
    guildSettingsRepository.ensureSettings(guild.id),
    communitySettingsService.ensureGuildSettings(guild.id)
  ]);

  if (botSettings.rules_enabled && botSettings.rules_channel_id && botSettings.rules_verified_role_id) {
    const rulesChannel = await fetchTextChannel(client, botSettings.rules_channel_id);
    if (rulesChannel) {
      await upsertPanel(rulesChannel, PANEL_MARKERS.rules, buildRulesPanel(guild), client.user.id);
    }
  }

  if (gallerySettings.showcase_channel_id) {
    const showcaseChannel = await fetchTextChannel(client, gallerySettings.showcase_channel_id);
    if (showcaseChannel) {
      await upsertPanel(
        showcaseChannel,
        PANEL_MARKERS.showcase,
        buildGalleryGuidePanel(CATEGORIES.SHOWCASE),
        client.user.id
      );
    }
  }

  if (gallerySettings.meme_channel_id) {
    const memeChannel = await fetchTextChannel(client, gallerySettings.meme_channel_id);
    if (memeChannel) {
      await upsertPanel(
        memeChannel,
        PANEL_MARKERS.meme,
        buildGalleryGuidePanel(CATEGORIES.MEME),
        client.user.id
      );
    }
  }

  if (communitySettings.video_enabled && communitySettings.video_channel_id) {
    const videoChannel = await fetchTextChannel(client, communitySettings.video_channel_id);
    if (videoChannel) {
      await upsertPanel(
        videoChannel,
        PANEL_MARKERS.video,
        buildVideoGuidePanel(),
        client.user.id
      );
    }
  }

  const levelingChannelId = levelingSettings.info_channel_id || levelingSettings.levelup_channel_id || config.leveling.infoChannelId || null;
  if (levelingChannelId) {
    const levelingChannel = await fetchTextChannel(client, levelingChannelId);
    if (levelingChannel) {
      await upsertPanel(
        levelingChannel,
        PANEL_MARKERS.leveling,
        buildLevelingGuidePanel(),
        client.user.id
      );
    }
  }
}

module.exports = {
  refreshGuildPanels,
  supportLine
};
