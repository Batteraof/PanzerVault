const config = require('../../../config');
const guildSettingsRepository = require('../../../db/repositories/guildSettingsRepository');
const botSettingsService = require('../../config/services/botSettingsService');
const communitySettingsService = require('../../config/services/communitySettingsService');
const onboardingRoleService = require('../../config/services/onboardingRoleService');
const gallerySettingsService = require('../../gallery/services/gallerySettingsService');
const ticketSettingsService = require('../../tickets/services/ticketSettingsService');

function normalizeId(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function toLookup(items = []) {
  return new Map((items || []).map(item => [String(item.id), item]));
}

function normalizeMetadata(metadata = {}) {
  const channels = metadata.channels instanceof Map ? metadata.channels : toLookup(metadata.channels);
  const roles = metadata.roles instanceof Map ? metadata.roles : toLookup(metadata.roles);

  return { channels, roles };
}

function makeItem(status, label, message) {
  return { status, label, message };
}

function countByStatus(items = []) {
  return items.reduce((counts, entry) => {
    counts[entry.status] = (counts[entry.status] || 0) + 1;
    return counts;
  }, { ok: 0, warn: 0, error: 0, off: 0 });
}

function summarizeSectionStatus(items = []) {
  const counts = countByStatus(items);
  if (counts.error > 0) return 'error';
  if (counts.warn > 0) return 'warn';
  if (counts.ok === 0 && counts.off > 0) return 'off';
  return 'ok';
}

function defaultSectionSummary(status, counts) {
  if (status === 'error') {
    return `${counts.error} critical setup gap${counts.error === 1 ? '' : 's'} need attention.`;
  }

  if (status === 'warn') {
    return `${counts.warn} follow-up item${counts.warn === 1 ? '' : 's'} should be cleaned up.`;
  }

  if (status === 'off') {
    return 'This system is currently disabled.';
  }

  return 'Ready for live use.';
}

function buildSection(key, title, items, summary) {
  const counts = countByStatus(items);
  const status = summarizeSectionStatus(items);

  return {
    key,
    title,
    status,
    summary: summary || defaultSectionSummary(status, counts),
    items
  };
}

function buildSummary(sections) {
  const summary = {
    okCount: 0,
    warnCount: 0,
    errorCount: 0,
    offCount: 0,
    totalSections: sections.length,
    overallStatus: 'ok'
  };

  for (const section of sections) {
    if (section.status === 'error') summary.errorCount += 1;
    else if (section.status === 'warn') summary.warnCount += 1;
    else if (section.status === 'off') summary.offCount += 1;
    else summary.okCount += 1;
  }

  if (summary.errorCount > 0) summary.overallStatus = 'error';
  else if (summary.warnCount > 0) summary.overallStatus = 'warn';
  else if (summary.okCount === 0 && summary.offCount > 0) summary.overallStatus = 'off';

  return summary;
}

function hasChannel(metadata, channelId) {
  return Boolean(channelId && metadata.channels.has(String(channelId)));
}

function hasRole(metadata, roleId) {
  return Boolean(roleId && metadata.roles.has(String(roleId)));
}

function channelItem(metadata, channelId, label, options = {}) {
  const normalizedId = normalizeId(channelId);
  const missingStatus = options.missingStatus || 'error';
  const missingMessage = options.missingMessage || 'Not configured yet.';
  const brokenMessage = options.brokenMessage || 'Configured ID no longer exists in this server.';

  if (!normalizedId) {
    return makeItem(missingStatus, label, missingMessage);
  }

  if (!hasChannel(metadata, normalizedId)) {
    return makeItem('error', label, brokenMessage);
  }

  return makeItem('ok', label, 'Configured and visible to the bot.');
}

function roleItem(metadata, roleId, label, options = {}) {
  const normalizedId = normalizeId(roleId);
  const missingStatus = options.missingStatus || 'error';
  const missingMessage = options.missingMessage || 'Not configured yet.';
  const brokenMessage = options.brokenMessage || 'Configured role no longer exists in this server.';

  if (!normalizedId) {
    return makeItem(missingStatus, label, missingMessage);
  }

  if (!hasRole(metadata, normalizedId)) {
    return makeItem('error', label, brokenMessage);
  }

  return makeItem('ok', label, 'Configured and available.');
}

function offSection(key, title, message) {
  return buildSection(key, title, [
    makeItem('off', title, message)
  ], message);
}

function buildCoreRoutingSection(botSettings, communitySettings, metadata) {
  const items = [];

  if (botSettings?.welcome_enabled === false) {
    items.push(makeItem('off', 'Welcome flow', 'Welcome messages are turned off for this guild.'));
  } else {
    items.push(channelItem(metadata, botSettings?.welcome_channel_id, 'Welcome channel'));
  }

  items.push(channelItem(
    metadata,
    communitySettings?.community_channel_id,
    'Main community channel',
    {
      missingStatus: 'warn',
      missingMessage: 'Not configured yet. Showcase and video heads-up posts will stay quiet until this is set.'
    }
  ));

  return buildSection('core-routing', 'Core Routing', items);
}

function buildRulesSection(botSettings, metadata) {
  if (botSettings?.rules_enabled === false) {
    return offSection('rules', 'Rules Verification', 'Rules gating is turned off for this guild.');
  }

  return buildSection('rules', 'Rules Verification', [
    channelItem(metadata, botSettings?.rules_channel_id, 'Rules channel'),
    roleItem(metadata, botSettings?.rules_verified_role_id, 'Verified role')
  ]);
}

function buildOnboardingSection(communitySettings, skillRoles, regionRoles, metadata) {
  const skillConfigured = onboardingRoleService.SKILL_OPTIONS.filter(option => {
    const roleId = skillRoles[option.key];
    return roleId && hasRole(metadata, roleId);
  }).length;

  const regionConfigured = onboardingRoleService.REGION_OPTIONS.filter(option => {
    const roleId = regionRoles[option.key];
    return roleId && hasRole(metadata, roleId);
  }).length;

  const items = [
    skillConfigured === onboardingRoleService.SKILL_OPTIONS.length
      ? makeItem('ok', 'Skill roles', `${skillConfigured}/${onboardingRoleService.SKILL_OPTIONS.length} required skill roles are mapped.`)
      : makeItem('error', 'Skill roles', `${skillConfigured}/${onboardingRoleService.SKILL_OPTIONS.length} required skill roles are mapped. Finish Beginner, Medium, and Expert before going live.`),
    regionConfigured > 0
      ? makeItem('ok', 'Region roles', `${regionConfigured}/${onboardingRoleService.REGION_OPTIONS.length} region roles are mapped.`)
      : makeItem('warn', 'Region roles', 'No region roles are mapped yet. Members can still join, but the onboarding experience is incomplete.'),
    roleItem(
      metadata,
      communitySettings?.coach_role_id,
      'Coach role',
      {
        missingStatus: 'warn',
        missingMessage: 'Optional, but recommended so Beginners can find Medium and Expert helpers.'
      }
    )
  ];

  return buildSection('onboarding', 'Onboarding Roles', items);
}

function buildLevelingSection(levelingSettings, communitySettings, metadata) {
  if (levelingSettings?.leveling_enabled === false) {
    return offSection('leveling', 'Leveling Feed', 'Leveling is disabled for this guild.');
  }

  const items = [
    channelItem(
      metadata,
      levelingSettings?.info_channel_id,
      'Leveling / community feed',
      {
        missingStatus: 'warn',
        missingMessage: 'Not configured yet. Anniversaries and recap-style posts will not have a clear home.'
      }
    )
  ];

  const xpModesEnabled = [levelingSettings?.text_xp_enabled, levelingSettings?.voice_xp_enabled]
    .filter(value => value !== false)
    .length;

  if (xpModesEnabled === 0) {
    items.push(makeItem('warn', 'XP sources', 'Text XP and voice XP are both off, so leveling will not move.'));
  } else {
    items.push(makeItem('ok', 'XP sources', `${xpModesEnabled} leveling source${xpModesEnabled === 1 ? '' : 's'} active.`));
  }

  return buildSection('leveling', 'Leveling Feed', items);
}

function buildMediaSection(communitySettings, metadata) {
  return buildSection('media', 'Media Intake', [
    channelItem(
      metadata,
      communitySettings?.media_channel_id,
      'Media channel',
      {
        missingStatus: 'warn',
        missingMessage: 'Not configured yet. Direct media uploads will stay manual until you set a shared media channel.'
      }
    )
  ]);
}

function buildGallerySection(gallerySettings, communitySettings, metadata) {
  if (communitySettings?.media_channel_id) {
    return buildSection(
      'gallery',
      'Gallery',
      [
        makeItem('ok', 'Shared media flow', 'Direct uploads are handled through the shared media channel. Separate showcase and meme archive channels are optional.'),
        hasChannel(metadata, gallerySettings?.showcase_channel_id)
          ? makeItem('ok', 'Showcase archive', 'Configured and visible to the bot.')
          : makeItem('ok', 'Showcase archive', 'Optional and not configured.'),
        hasChannel(metadata, gallerySettings?.meme_channel_id)
          ? makeItem('ok', 'Meme archive', 'Configured and visible to the bot.')
          : makeItem('ok', 'Meme archive', 'Optional and not configured.')
      ],
      'Shared media intake is live. Separate archive channels are optional.'
    );
  }

  return buildSection('gallery', 'Gallery', [
    channelItem(metadata, gallerySettings?.showcase_channel_id, 'Showcase channel'),
    channelItem(metadata, gallerySettings?.meme_channel_id, 'Meme channel'),
    channelItem(
      metadata,
      gallerySettings?.log_channel_id,
      'Gallery log channel',
      {
        missingStatus: 'warn',
        missingMessage: 'Optional, but recommended so staff can review removals and moderation actions.'
      }
    )
  ]);
}

function buildVideoSection(communitySettings, metadata) {
  if (communitySettings?.media_channel_id) {
    return buildSection(
      'video',
      'Video Submissions',
      [
        makeItem('ok', 'Shared media flow', 'Videos and YouTube links are handled in the shared media channel. A separate video archive channel is optional.'),
        hasChannel(metadata, communitySettings?.video_channel_id)
          ? makeItem('ok', 'Video archive channel', 'Configured and visible to the bot.')
          : makeItem('ok', 'Video archive channel', 'Optional and not configured.')
      ],
      'Shared media intake is configured. Separate video archive is optional.'
    );
  }

  if (communitySettings?.video_enabled === false) {
    return offSection('video', 'Video Submissions', 'Video submissions are disabled for this guild.');
  }

  return buildSection('video', 'Video Submissions', [
    channelItem(metadata, communitySettings?.video_channel_id, 'Video channel'),
    channelItem(
      metadata,
      communitySettings?.community_channel_id,
      'Main community channel',
      {
        missingStatus: 'warn',
        missingMessage: 'Optional, but recommended so the bot can drop a short heads-up when new videos are approved.'
      }
    )
  ]);
}

function buildEventsSection(communitySettings, metadata) {
  if (communitySettings?.event_enabled === false) {
    return offSection('events', 'Events', 'Events and RSVP reminders are disabled for this guild.');
  }

  return buildSection('events', 'Events', [
    channelItem(metadata, communitySettings?.event_channel_id, 'Event channel')
  ]);
}

function buildSpotlightSection(communitySettings, metadata) {
  if (communitySettings?.spotlight_enabled === false) {
    return offSection('spotlight', 'Community Spotlight', 'Community Spotlight is disabled for this guild.');
  }

  return buildSection('spotlight', 'Community Spotlight', [
    channelItem(metadata, communitySettings?.spotlight_channel_id, 'Spotlight channel'),
    roleItem(metadata, communitySettings?.spotlight_role_id, 'Spotlight role')
  ]);
}

function buildTicketsSection(ticketSettings, metadata) {
  if (ticketSettings?.tickets_enabled === false) {
    return offSection('tickets', 'Tickets', 'Tickets are disabled for this guild.');
  }

  return buildSection('tickets', 'Tickets', [
    channelItem(metadata, ticketSettings?.category_channel_id, 'Ticket panel channel'),
    channelItem(
      metadata,
      ticketSettings?.log_channel_id,
      'Ticket log channel',
      {
        missingStatus: 'warn',
        missingMessage: 'Optional, but recommended so staff can review ticket closures and escalations.'
      }
    ),
    roleItem(
      metadata,
      ticketSettings?.support_role_id,
      'Support role',
      {
        missingStatus: 'warn',
        missingMessage: 'Optional, but recommended so ticket notifications can point at the right staff team.'
      }
    )
  ]);
}

function buildModerationSection(communitySettings, metadata) {
  if (communitySettings?.soft_moderation_enabled === false) {
    return offSection('moderation', 'Soft Moderation', 'Soft moderation is disabled for this guild.');
  }

  return buildSection('moderation', 'Soft Moderation', [
    channelItem(metadata, communitySettings?.moderation_log_channel_id, 'Moderation log channel')
  ]);
}

function buildReadinessReport(context) {
  const metadata = normalizeMetadata(context.metadata);
  const skillRoles = context.skillRoles || {};
  const regionRoles = context.regionRoles || {};

  const sections = [
    buildCoreRoutingSection(context.botSettings || {}, context.communitySettings || {}, metadata),
    buildRulesSection(context.botSettings || {}, metadata),
    buildOnboardingSection(context.communitySettings || {}, skillRoles, regionRoles, metadata),
    buildLevelingSection(context.levelingSettings || {}, context.communitySettings || {}, metadata),
    buildMediaSection(context.communitySettings || {}, metadata),
    buildGallerySection(context.gallerySettings || {}, context.communitySettings || {}, metadata),
    buildVideoSection(context.communitySettings || {}, metadata),
    buildEventsSection(context.communitySettings || {}, metadata),
    buildSpotlightSection(context.communitySettings || {}, metadata),
    buildTicketsSection(context.ticketSettings || {}, metadata),
    buildModerationSection(context.communitySettings || {}, metadata)
  ];

  return {
    guildId: context.guildId,
    generatedAt: new Date().toISOString(),
    summary: buildSummary(sections),
    sections
  };
}

async function collectGuildReadinessFromClient(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error(`Guild ${guildId} is not available in the bot cache.`);
  }

  const [botSettings, communitySettings, gallerySettings, ticketSettings, levelingSettings, skillRoles, regionRoles] = await Promise.all([
    botSettingsService.ensureGuildSettings(guildId),
    communitySettingsService.ensureGuildSettings(guildId),
    gallerySettingsService.ensureGuildSettings(guildId),
    ticketSettingsService.ensureGuildSettings(guildId),
    guildSettingsRepository.ensureSettings(guildId, { infoChannelId: config.leveling.infoChannelId || null }),
    onboardingRoleService.listRolesByGroup(guildId, 'skill'),
    onboardingRoleService.listRolesByGroup(guildId, 'region')
  ]);

  return buildReadinessReport({
    guildId,
    botSettings,
    communitySettings,
    gallerySettings,
    ticketSettings,
    levelingSettings,
    skillRoles: Object.fromEntries(skillRoles.map(row => [row.option_key, row.role_id])),
    regionRoles: Object.fromEntries(regionRoles.map(row => [row.option_key, row.role_id])),
    metadata: {
      channels: [...guild.channels.cache.values()].map(channel => ({ id: channel.id })),
      roles: [...guild.roles.cache.values()].map(role => ({ id: role.id }))
    }
  });
}

function logReadinessReport(logger, report) {
  const { summary } = report;
  logger.info(
    `[Startup check] Guild ${report.guildId}: ${summary.okCount} ready, ${summary.warnCount} attention, ${summary.errorCount} missing, ${summary.offCount} disabled.`
  );

  for (const section of report.sections) {
    if (section.status === 'ok') continue;

    logger.warn(`[Startup check] ${section.title}: ${section.summary}`);
    for (const entry of section.items.filter(item => item.status === 'warn' || item.status === 'error')) {
      logger.warn(`[Startup check] - ${entry.label}: ${entry.message}`);
    }
  }
}

async function runStartupChecks(client, logger) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const report = await collectGuildReadinessFromClient(client, guild.id);
      logReadinessReport(logger, report);
    } catch (error) {
      logger.error(`[Startup check] Failed for guild ${guild.id}`, error);
    }
  }
}

module.exports = {
  buildReadinessReport,
  collectGuildReadinessFromClient,
  logReadinessReport,
  runStartupChecks
};