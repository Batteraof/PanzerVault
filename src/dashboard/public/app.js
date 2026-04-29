const viewTitles = {
  overview: ['Overview', 'Community pulse and next actions'],
  events: ['Events', 'Create new sessions and watch RSVP flow'],
  content: ['Content', 'Gallery posts, videos, and contributor output'],
  tickets: ['Tickets', 'Categories, status, and response time'],
  analytics: ['Analytics', 'Activity trends and participation'],
  settings: ['Configuration', 'Setup readiness, live routing, and onboarding role mapping']
};

const SKILL_OPTIONS = [
  ['beginner', 'Beginner'],
  ['medium', 'Medium'],
  ['expert', 'Expert']
];

const REGION_OPTIONS = [
  ['eu', 'EU'],
  ['uk', 'UK'],
  ['na', 'NA'],
  ['latam', 'LATAM'],
  ['africa', 'AFRICA'],
  ['sa', 'SA'],
  ['ea', 'EA'],
  ['sea', 'SEA'],
  ['oce', 'OCE']
];

const TIME_ZONE_OPTIONS = [
  'Europe/Amsterdam',
  'Europe/London',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney'
];

const state = {
  overview: null,
  events: [],
  content: { gallery: [], videos: [] },
  tickets: [],
  analytics: [],
  settings: null
};

const uiState = {
  eventMessage: '',
  eventTone: 'info',
  botMessage: '',
  botTone: 'info',
  levelingMessage: '',
  levelingTone: 'info',
  communityMessage: '',
  communityTone: 'info',
  galleryMessage: '',
  galleryTone: 'info',
  galleryTagMessage: '',
  galleryTagTone: 'info',
  ticketSettingsMessage: '',
  ticketSettingsTone: 'info',
  rewardMessage: '',
  rewardTone: 'info',
  teamMessage: '',
  teamTone: 'info',
  publicRoleMessage: '',
  publicRoleTone: 'info',
  onboardingMessage: '',
  onboardingTone: 'info'
};

const numberFormatter = new Intl.NumberFormat();

function qs(selector) {
  return document.querySelector(selector);
}

function text(selector, value) {
  const element = qs(selector);
  if (element) element.textContent = value;
}

function html(selector, value) {
  const element = qs(selector);
  if (element) element.innerHTML = value;
}

function formatCount(value) {
  return numberFormatter.format(Number(value) || 0);
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatDay(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}

function formatShortDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${Math.max(0, minutes)}m`;
}

function formatResponseClock(seconds, status) {
  if (seconds == null) {
    return status === 'open'
      ? 'Awaiting first response'
      : 'Response captured after the first reply';
  }

  if (seconds < 3600) {
    return `${Math.max(1, Math.round(seconds / 60))}m to first response`;
  }

  const hours = seconds / 3600;
  return `${hours >= 2 ? Math.round(hours) : hours.toFixed(1)}h to first response`;
}

function titleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function memberName(item) {
  if (item?.display_name) return item.display_name;
  if (item?.username) return item.username;
  const userId = String(item?.user_id || 'member');
  return `Member ${userId.slice(-4)}`;
}

function renderEmpty(title, detail = '') {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      ${detail ? `<span>${escapeHtml(detail)}</span>` : ''}
    </div>
  `;
}

function renderStatusMessage(message, tone = 'info') {
  if (!message) return '';
  return `<div class="status-inline ${escapeHtml(tone)}">${escapeHtml(message)}</div>`;
}

function readinessLabel(status) {
  const labels = {
    ok: 'Ready',
    warn: 'Follow up',
    error: 'Needs setup',
    off: 'Disabled'
  };

  return labels[status] || titleCase(status || 'unknown');
}

function renderReadiness() {
  const report = state.settings?.readiness;

  if (!report) {
    html('#readiness-overview', renderEmpty('Readiness data is not available yet.', 'Refresh the dashboard once the bot can reach Discord and the database.'));
    return;
  }

  const summary = report.summary || {};
  const cards = [
    ['Ready', summary.okCount || 0],
    ['Follow up', summary.warnCount || 0],
    ['Needs setup', summary.errorCount || 0],
    ['Disabled', summary.offCount || 0],
    ['Sections', summary.totalSections || 0]
  ];

  html('#readiness-overview', `
    <div class="readiness-panel-shell">
      <div class="readiness-summary">
        ${cards.map(([label, value]) => `
          <article class="readiness-summary-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatCount(value))}</strong>
          </article>
        `).join('')}
      </div>

      <div class="readiness-grid">
        ${(report.sections || []).map(section => `
          <article class="readiness-card ${escapeHtml(section.status)}">
            <div class="readiness-card-head">
              <div>
                <strong>${escapeHtml(section.title)}</strong>
                <p class="readiness-card-summary">${escapeHtml(section.summary || '')}</p>
              </div>
              <span class="status-chip ${escapeHtml(section.status)}">${escapeHtml(readinessLabel(section.status))}</span>
            </div>

            <div class="readiness-items">
              ${(section.items || []).map(item => `
                <div class="readiness-item">
                  <div class="readiness-item-head">
                    <strong>${escapeHtml(item.label)}</strong>
                    <span class="status-chip ${escapeHtml(item.status)}">${escapeHtml(readinessLabel(item.status))}</span>
                  </div>
                  <span>${escapeHtml(item.message)}</span>
                </div>
              `).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `);
}

function row({ title, meta, detail = '', pill = '' }) {
  return `
    <div class="row">
      <div class="row-body">
        <strong>${escapeHtml(title)}</strong>
        <div class="meta">${escapeHtml(meta)}</div>
        ${detail ? `<div class="submeta">${escapeHtml(detail)}</div>` : ''}
      </div>
      ${pill ? `<span class="pill">${escapeHtml(pill)}</span>` : ''}
    </div>
  `;
}

function setRefreshState(isLoading) {
  const button = qs('#refresh-button');
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Refreshing...' : 'Refresh';
}

function setStatus(message, isError = false) {
  const element = qs('#last-updated');
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('is-error', Boolean(isError));
}

function getBotSettings() {
  return state.settings?.botSettings || {};
}

function getCommunitySettings() {
  return state.settings?.communitySettings || {};
}

function getGallerySettings() {
  return state.settings?.gallerySettings || {};
}

function getTicketSettings() {
  return state.settings?.ticketSettings || {};
}

function getLevelingSettings() {
  return state.settings?.levelingSettings || {};
}

function getRewardRoles() {
  return state.settings?.rewardRoles || [];
}

function getTeamRoles() {
  return state.settings?.teamRoles || [];
}

function getPublicRoles() {
  return state.settings?.publicRoles || [];
}

function getGalleryTags() {
  return state.settings?.galleryTags || [];
}

function getMetadata() {
  return state.settings?.metadata || { channels: [], categories: [], roles: [] };
}

function getOnboarding() {
  return state.settings?.onboarding || { skillRoles: {}, regionRoles: {} };
}

function findItem(items, id) {
  const normalized = id == null ? '' : String(id);
  return (items || []).find(item => String(item.id) === normalized) || null;
}

function labelFor(items, id, fallback = 'Not set') {
  if (!id) return fallback;
  return findItem(items, id)?.label || fallback;
}

function selectOptions(items, selectedId, placeholder = 'Not set') {
  const selected = selectedId == null ? '' : String(selectedId);
  return [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...(items || []).map(item => `
      <option value="${escapeHtml(item.id)}"${String(item.id) === selected ? ' selected' : ''}>
        ${escapeHtml(item.label || item.name || item.id)}
      </option>
    `)
  ].join('');
}

function timeZoneOptions(selectedTimeZone) {
  const selected = selectedTimeZone || 'UTC';
  const options = [...new Set([selected, ...TIME_ZONE_OPTIONS])];
  return options.map(timeZone => `
    <option value="${escapeHtml(timeZone)}"${timeZone === selected ? ' selected' : ''}>
      ${escapeHtml(timeZone)}
    </option>
  `).join('');
}

function renderToggleControl(name, title, detail, checked) {
  return `
    <label class="toggle-card">
      <input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''}>
      <span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(detail)}</small>
      </span>
    </label>
  `;
}

function renderOverview() {
  const data = state.overview || {};
  text('#active-users', formatCount(data.activeUsers));
  text('#event-count', formatCount((data.upcomingEvents || []).length));
  text('#open-tickets', formatCount(data.openTickets));
  text('#content-count', formatCount((data.featuredContent || []).length));

  html(
    '#overview-events',
    (data.upcomingEvents || []).map(event => row({
      title: event.title,
      meta: formatDateTime(event.starts_at),
      detail: `${formatCount(event.going_count)} going${event.maybe_count ? ` - ${formatCount(event.maybe_count)} maybe` : ''}`,
      pill: titleCase(event.status || 'scheduled')
    })).join('') || renderEmpty('No upcoming events yet.', 'Create the next session from the Events tab or with /event create so members have something to rally around.')
  );

  html(
    '#top-contributors',
    (data.topContributors || []).map(user => row({
      title: memberName(user),
      meta: `Level ${formatCount(user.level)} - ${formatCount(user.total_xp)} XP`,
      detail: `${formatCount(user.message_count)} messages - ${formatShortDuration(user.total_voice_seconds)} voice`,
      pill: 'XP'
    })).join('') || renderEmpty('No contributor data yet.', 'Once members chat, post, and join voice sessions, the top contributors list will start to fill in.')
  );
}

function renderEventComposer() {
  const community = getCommunitySettings();
  const channels = getMetadata().channels;
  const eventsEnabled = community.event_enabled !== false;
  const hasEventChannel = Boolean(community.event_channel_id);
  const channelLabel = labelFor(channels, community.event_channel_id, 'No event channel configured');
  const defaultTimeZone = state.settings?.serverTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  let calloutTone = 'info';
  let calloutTitle = `Posts will go to ${channelLabel}.`;
  let calloutBody = 'The dashboard uses the same event service as the Discord command flow, so RSVP posts stay consistent.';

  if (!eventsEnabled) {
    calloutTone = 'warn';
    calloutTitle = 'Events are currently disabled.';
    calloutBody = 'Turn events back on in Community Settings before posting from the dashboard.';
  } else if (!hasEventChannel) {
    calloutTone = 'warn';
    calloutTitle = 'Choose an event channel first.';
    calloutBody = 'Set the event channel in Community Settings so the dashboard knows where to post the RSVP embed.';
  }

  html('#event-composer', `
    <div class="callout ${escapeHtml(calloutTone)}">
      <strong>${escapeHtml(calloutTitle)}</strong>
      <span>${escapeHtml(calloutBody)}</span>
    </div>
    <form id="event-create-form" class="form-stack">
      <div class="form-grid">
        <label class="field field-span-2">
          <span>Event title</span>
          <input type="text" name="title" maxlength="120" minlength="3" placeholder="Armor training, community match, meme night..." required>
          <small>The title becomes the RSVP embed heading in Discord.</small>
        </label>

        <label class="field">
          <span>Start time</span>
          <input type="datetime-local" name="startsAt" required>
          <small>Discord shows the posted timestamp in each member's own timezone.</small>
        </label>

        <label class="field">
          <span>Timezone</span>
          <input type="text" name="timeZone" list="event-time-zone-options" value="${escapeHtml(defaultTimeZone)}" placeholder="Europe/Amsterdam">
          <datalist id="event-time-zone-options">${timeZoneOptions(defaultTimeZone)}</datalist>
          <small>Defaults to the dashboard server timezone.</small>
        </label>

        <label class="field">
          <span>Optional link</span>
          <input type="url" name="externalUrl" placeholder="https://...">
          <small>Briefings, sign-up sheets, or external event notes.</small>
        </label>

        <label class="field">
          <span>Style picture</span>
          <input type="url" name="imageUrl" maxlength="500" placeholder="https://...">
          <small>Shown as the event embed image in Discord.</small>
        </label>
      </div>

      <label class="field">
        <span>Description</span>
        <textarea name="description" rows="5" maxlength="600" placeholder="Let members know what the session is for, who it is aimed at, and anything they should prepare."></textarea>
        <small>Optional, but it makes the event post feel much more intentional.</small>
      </label>

      ${renderStatusMessage(uiState.eventMessage, uiState.eventTone)}

      <div class="action-row">
        <button class="button-primary" type="submit" ${!eventsEnabled || !hasEventChannel ? 'disabled' : ''}>Create Event</button>
      </div>
    </form>
  `);

  const form = qs('#event-create-form');
  if (form) form.addEventListener('submit', handleEventCreateSubmit);
}

function renderEvents() {
  renderEventComposer();

  html(
    '#events-list',
    state.events.map(event => row({
      title: event.title,
      meta: formatDateTime(event.starts_at),
      detail: `${formatCount(event.going_count)} going - ${formatCount(event.maybe_count)} maybe - ${formatCount(event.attendance_count)} checked in${event.external_url ? ' - linked briefing' : ''}`,
      pill: titleCase(event.status || 'scheduled')
    })).join('') || renderEmpty('No events found.', 'Scheduled events will appear here with their RSVP and attendance signal.')
  );
}

function renderContent() {
  const gallery = (state.content.gallery || []).map(item => ({
    kind: titleCase(item.category || 'gallery'),
    title: item.caption || `Gallery #${item.id}`,
    createdAt: item.created_at,
    meta: `${memberName(item)} - posted to gallery`,
    detail: Array.isArray(item.tags) && item.tags.length ? item.tags.join(', ') : 'No tags yet'
  }));

  const videos = (state.content.videos || []).map(item => ({
    kind: 'Video',
    title: item.title,
    createdAt: item.created_at,
    meta: `${memberName(item)} - YouTube post`,
    detail: Object.values(item.tags || {}).filter(Boolean).join(', ') || 'No tags yet'
  }));

  const items = [...gallery, ...videos].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  html(
    '#content-grid',
    items.map(item => `
      <article class="content-item">
        <div class="content-head">
          <span class="pill">${escapeHtml(item.kind)}</span>
          <span class="content-date">${escapeHtml(formatDateTime(item.createdAt))}</span>
        </div>
        <strong>${escapeHtml(item.title)}</strong>
        <div class="meta">${escapeHtml(item.meta)}</div>
        <div class="tag-line">${escapeHtml(item.detail)}</div>
      </article>
    `).join('') || renderEmpty('No content found.', 'Posted gallery entries and approved video submissions will surface here.')
  );
}

function renderTickets() {
  const categories = ['support', 'report', 'application', 'event_issue'];
  const labels = {
    support: 'Support',
    report: 'Reports',
    application: 'Applications',
    event_issue: 'Event Issues'
  };

  html(
    '#ticket-board',
    categories.map(category => {
      const tickets = state.tickets.filter(ticket => ticket.category === category);
      return `
        <div class="ticket-column">
          <h3>${labels[category]}</h3>
          ${tickets.map(ticket => `
            <article class="ticket-card">
              <div class="ticket-card-top">
                <span class="pill">${escapeHtml(titleCase(ticket.status || 'open'))}</span>
              </div>
              <strong>#${ticket.id} ${escapeHtml(ticket.subject || 'No subject')}</strong>
              <div class="meta">Opened by ${escapeHtml(memberName(ticket))}</div>
              <div class="submeta">${escapeHtml(formatResponseClock(ticket.response_seconds, ticket.status))}</div>
            </article>
          `).join('') || renderEmpty(`${labels[category]} clear.`, 'Nothing in this queue right now.')}
        </div>
      `;
    }).join('')
  );
}

function renderAnalytics() {
  const max = Math.max(1, ...state.analytics.map(day => day.messages + day.gallery_posts + day.video_posts));

  html(
    '#analytics-bars',
    state.analytics.map(day => {
      const total = day.messages + day.gallery_posts + day.video_posts;
      const width = Math.max(4, Math.round((total / max) * 100));
      return `
        <div class="bar-row">
          <span>${escapeHtml(formatDay(day.day))}</span>
          <div>
            <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
            <div class="bar-detail">${escapeHtml(`${formatCount(day.messages)} messages - ${formatCount(day.gallery_posts)} gallery - ${formatCount(day.video_posts)} videos`)}</div>
          </div>
          <strong>${escapeHtml(formatCount(total))}</strong>
        </div>
      `;
    }).join('') || renderEmpty('No analytics yet.', 'Once the bot sees posts and activity, trend lines will appear here.')
  );
}

function renderBotSettings() {
  const bot = getBotSettings();
  const metadata = getMetadata();

  html('#bot-settings', `
    <div class="panel-note">Control welcome routing and the permanent roles channel. Discord Onboarding handles server rules and first-join verification.</div>
    <form id="bot-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Welcome</h3>
        <div class="toggle-grid">
          ${renderToggleControl('welcomeEnabled', 'Welcome messages', 'Send the configured welcome note when members join.', bot.welcome_enabled !== false)}
        </div>
      </section>

      <section class="settings-section">
        <h3>Routing</h3>
        <div class="form-grid">
          <label class="field">
            <span>Welcome channel</span>
            <select name="welcomeChannelId">${selectOptions(metadata.channels, bot.welcome_channel_id, 'Choose a welcome channel')}</select>
            <small>New member welcome messages are posted here.</small>
          </label>

          <label class="field">
            <span>Role panel channel</span>
            <select name="rolePanelChannelId">${selectOptions(metadata.channels, bot.role_panel_channel_id, 'Choose the roles channel')}</select>
            <small>The always-on member role picker is posted and refreshed here.</small>
          </label>
        </div>
      </section>

      ${renderStatusMessage(uiState.botMessage, uiState.botTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Bot Settings</button>
        <button class="button-secondary" type="button" id="test-welcome-button">Send Test Welcome</button>
      </div>
    </form>
  `);

  const form = qs('#bot-settings-form');
  if (form) form.addEventListener('submit', handleBotSettingsSubmit);
  const testWelcomeButton = qs('#test-welcome-button');
  if (testWelcomeButton) testWelcomeButton.addEventListener('click', handleTestWelcomeClick);
}

function renderLevelingSettings() {
  const leveling = getLevelingSettings();
  const metadata = getMetadata();

  html('#leveling-settings', `
    <div class="panel-note">Tune XP sources, level-up announcements, and the info panel channel used by the server panel refresh flow.</div>
    <form id="leveling-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>XP controls</h3>
        <div class="toggle-grid">
          ${renderToggleControl('levelingEnabled', 'Leveling', 'Allow XP to be awarded and levels to move.', leveling.leveling_enabled !== false)}
          ${renderToggleControl('textXpEnabled', 'Text XP', 'Award XP for eligible chat activity.', leveling.text_xp_enabled !== false)}
          ${renderToggleControl('voiceXpEnabled', 'Voice XP', 'Award XP for eligible voice time.', leveling.voice_xp_enabled !== false)}
          ${renderToggleControl('dmLevelupEnabled', 'Level-up DMs', 'Send members a direct message when they level up.', leveling.dm_levelup_enabled === true)}
        </div>
      </section>

      <section class="settings-section">
        <h3>Channels</h3>
        <div class="form-grid">
          <label class="field">
            <span>Level-up channel</span>
            <select name="levelupChannelId">${selectOptions(metadata.channels, leveling.levelup_channel_id, 'Choose a level-up channel')}</select>
            <small>Public level-up announcements are posted here.</small>
          </label>

          <label class="field">
            <span>Leveling info channel</span>
            <select name="infoChannelId">${selectOptions(metadata.channels, leveling.info_channel_id, 'Choose a leveling info channel')}</select>
            <small>The leveling guide panel uses this channel.</small>
          </label>
        </div>
      </section>

      ${renderStatusMessage(uiState.levelingMessage, uiState.levelingTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Leveling Settings</button>
      </div>
    </form>
  `);

  const form = qs('#leveling-settings-form');
  if (form) form.addEventListener('submit', handleLevelingSettingsSubmit);
}

function renderCommunitySettings() {
  const community = getCommunitySettings();
  const metadata = getMetadata();

  html('#community-settings', `
    <div class="panel-note">Use this to steer where the bot posts and which community systems are currently active. These values map to the same live settings rows used by the Discord-side config flow.</div>
    <form id="community-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Feature toggles</h3>
        <div class="toggle-grid">
          ${renderToggleControl('onboardingEnabled', 'Bot role onboarding', 'Use the bot role panel for skill and region roles. Turn this off when Discord Onboarding assigns those roles.', community.onboarding_enabled !== false)}
          ${renderToggleControl('eventEnabled', 'Events', 'Allow RSVP events and reminders to run.', community.event_enabled !== false)}
          ${renderToggleControl('videoEnabled', 'Video submissions', 'Accept curated YouTube posts through /submit.', community.video_enabled !== false)}
          ${renderToggleControl('spotlightEnabled', 'Community spotlight', 'Keep spotlight nominations and monthly rotation active.', community.spotlight_enabled !== false)}
          ${renderToggleControl('anniversaryEnabled', 'Anniversary announcements', 'Celebrate member milestones in the leveling/community channel.', community.anniversary_enabled !== false)}
          ${renderToggleControl('weeklyRecapEnabled', 'Weekly recap', 'Allow the weekly recap job to post its summary.', community.weekly_recap_enabled !== false)}
          ${renderToggleControl('softModerationEnabled', 'Soft moderation', 'Warn, log, and clean up obvious spam behavior.', community.soft_moderation_enabled !== false)}
        </div>
      </section>

      <section class="settings-section">
        <h3>Channel routing</h3>
        <div class="form-grid">
          <label class="field">
            <span>Main community channel</span>
            <select name="communityChannelId">${selectOptions(metadata.channels, community.community_channel_id, 'Choose a community channel')}</select>
            <small>Used for showcase and video notifications, plus other broad community callouts.</small>
          </label>

          <label class="field">
            <span>Shared media channel</span>
            <select name="mediaChannelId">${selectOptions(metadata.channels, community.media_channel_id, 'Choose a media intake channel')}</select>
            <small>Direct image, video, and link submissions are watched here.</small>
          </label>

          <label class="field">
            <span>Event channel</span>
            <select name="eventChannelId">${selectOptions(metadata.channels, community.event_channel_id, 'Choose an event channel')}</select>
            <small>New dashboard-created events post their RSVP embeds here.</small>
          </label>

          <label class="field">
            <span>Video channel</span>
            <select name="videoChannelId">${selectOptions(metadata.channels, community.video_channel_id, 'Choose a video channel')}</select>
            <small>The video branch of /submit sends curated YouTube posts here.</small>
          </label>

          <label class="field">
            <span>Spotlight channel</span>
            <select name="spotlightChannelId">${selectOptions(metadata.channels, community.spotlight_channel_id, 'Choose a spotlight channel')}</select>
            <small>The monthly spotlight winner and archive live here.</small>
          </label>

          <label class="field">
            <span>Moderation log channel</span>
            <select name="moderationLogChannelId">${selectOptions(metadata.channels, community.moderation_log_channel_id, 'Choose a moderation log channel')}</select>
            <small>Soft moderation and staff-facing moderation signals route to this channel.</small>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>Recognition roles</h3>
        <div class="form-grid">
          <label class="field field-span-2">
            <span>Spotlight role</span>
            <select name="spotlightRoleId">${selectOptions(metadata.roles, community.spotlight_role_id, 'Choose the spotlight role')}</select>
            <small>Applied to the current Community Spotlight winner.</small>
          </label>
          <label class="field field-span-2">
            <span>Event ping role</span>
            <select name="eventRoleId">${selectOptions(metadata.roles, community.event_role_id, 'Choose the event ping role')}</select>
            <small>Mentioned on new events and reminders. Going or Maybe RSVPs also receive this role.</small>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>Weekly recap</h3>
        <label class="field">
          <span>Next recap note</span>
          <textarea name="weeklyRecapNote" rows="4" maxlength="300" placeholder="Optional staff note for the next weekly recap.">${escapeHtml(community.weekly_recap_note || '')}</textarea>
          <small>This note is included once, then cleared after the weekly recap posts.</small>
        </label>
      </section>

      ${renderStatusMessage(uiState.communityMessage, uiState.communityTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Community Settings</button>
      </div>
    </form>
  `);

  const form = qs('#community-settings-form');
  if (form) form.addEventListener('submit', handleCommunitySettingsSubmit);
}

function renderGallerySettings() {
  const gallery = getGallerySettings();
  const tags = getGalleryTags();
  const metadata = getMetadata();

  html('#gallery-settings', `
    <div class="panel-note">Set the channels used by gallery submissions and staff-facing gallery moderation logs.</div>
    <form id="gallery-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Gallery flow</h3>
        <div class="toggle-grid">
          ${renderToggleControl('galleryEnabled', 'Gallery submissions', 'Allow members to submit showcase and meme posts.', gallery.gallery_enabled !== false)}
        </div>
      </section>

      <section class="settings-section">
        <h3>Channels</h3>
        <div class="form-grid">
          <label class="field">
            <span>Showcase channel</span>
            <select name="showcaseChannelId">${selectOptions(metadata.channels, gallery.showcase_channel_id, 'Choose a showcase channel')}</select>
            <small>Finished showcase submissions post here.</small>
          </label>

          <label class="field">
            <span>Meme channel</span>
            <select name="memeChannelId">${selectOptions(metadata.channels, gallery.meme_channel_id, 'Choose a meme channel')}</select>
            <small>Finished meme submissions post here.</small>
          </label>

          <label class="field field-span-2">
            <span>Gallery log channel</span>
            <select name="galleryLogChannelId">${selectOptions(metadata.channels, gallery.log_channel_id, 'Choose a gallery log channel')}</select>
            <small>Moderation actions and gallery audit notes are posted here.</small>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>Approved tags</h3>
        <div class="form-grid">
          <label class="field">
            <span>New tag</span>
            <input type="text" name="tagName" maxlength="60" placeholder="US Tanks, Events, Builds...">
            <small>Members can only use approved tags during gallery submission.</small>
          </label>

          <label class="field">
            <span>Tag category</span>
            <select name="tagCategory">
              <option value="all">All gallery categories</option>
              <option value="showcase">Showcase only</option>
              <option value="meme">Meme only</option>
            </select>
            <small>Use a category restriction only when a tag should be limited.</small>
          </label>
        </div>

        <div class="tag-admin-list">
          ${tags.map(tag => {
            const category = Array.isArray(tag.allowed_categories) && tag.allowed_categories.length
              ? tag.allowed_categories.join(', ')
              : 'all';
            return `
              <div class="tag-admin-row">
                <div>
                  <strong>${escapeHtml(tag.tag_name)}</strong>
                  <span>${escapeHtml(category)}</span>
                </div>
                <button class="button-secondary compact-button gallery-tag-remove-button" type="button" data-tag-name="${escapeHtml(tag.normalized_name || tag.tag_name)}">Remove</button>
              </div>
            `;
          }).join('') || renderEmpty('No gallery tags configured yet.', 'Default tags will appear once gallery setup runs, or you can add one here.')}
        </div>
      </section>

      ${renderStatusMessage(uiState.galleryMessage, uiState.galleryTone)}
      ${renderStatusMessage(uiState.galleryTagMessage, uiState.galleryTagTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Gallery Settings</button>
        <button class="button-secondary" type="button" id="gallery-tag-add-button">Add Tag</button>
      </div>
    </form>
  `);

  const form = qs('#gallery-settings-form');
  if (form) form.addEventListener('submit', handleGallerySettingsSubmit);
  const addTagButton = qs('#gallery-tag-add-button');
  if (addTagButton) addTagButton.addEventListener('click', handleGalleryTagAddClick);
  document.querySelectorAll('.gallery-tag-remove-button').forEach(button => {
    button.addEventListener('click', handleGalleryTagRemoveClick);
  });
}

function renderTicketSettings() {
  const tickets = getTicketSettings();
  const metadata = getMetadata();

  html('#ticket-settings', `
    <div class="panel-note">Configure where ticket channels are created, where ticket audit logs go, and which staff role can see new tickets.</div>
    <form id="ticket-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Ticket flow</h3>
        <div class="toggle-grid">
          ${renderToggleControl('ticketsEnabled', 'Tickets', 'Allow members to open support, report, application, and event issue tickets.', tickets.tickets_enabled !== false)}
        </div>
      </section>

      <section class="settings-section">
        <h3>Routing and staff</h3>
        <div class="form-grid">
          <label class="field">
            <span>Ticket category</span>
            <select name="ticketCategoryId">${selectOptions(metadata.categories, tickets.category_channel_id, 'Choose a ticket category')}</select>
            <small>New private ticket channels are created under this Discord category.</small>
          </label>

          <label class="field">
            <span>Ticket log channel</span>
            <select name="ticketLogChannelId">${selectOptions(metadata.channels, tickets.log_channel_id, 'Choose a ticket log channel')}</select>
            <small>Open, close, and escalation logs post here.</small>
          </label>

          <label class="field field-span-2">
            <span>Support role</span>
            <select name="supportRoleId">${selectOptions(metadata.roles, tickets.support_role_id, 'Choose the support staff role')}</select>
            <small>This role receives access to new ticket channels.</small>
          </label>
        </div>
      </section>

      ${renderStatusMessage(uiState.ticketSettingsMessage, uiState.ticketSettingsTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Ticket Settings</button>
      </div>
    </form>
  `);

  const form = qs('#ticket-settings-form');
  if (form) form.addEventListener('submit', handleTicketSettingsSubmit);
}

function renderRewardSettings() {
  const rewards = getRewardRoles();
  const metadata = getMetadata();

  html('#reward-settings', `
    <div class="panel-note">Add automatic level reward roles. The bot will grant these roles when a member reaches the configured level.</div>
    <form id="reward-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Add or update reward</h3>
        <div class="form-grid">
          <label class="field">
            <span>Reward role</span>
            <select name="roleId" required>${selectOptions(metadata.roles, '', 'Choose a reward role')}</select>
            <small>Pick the role the bot should grant automatically.</small>
          </label>

          <label class="field">
            <span>Required level</span>
            <input type="number" name="requiredLevel" min="1" max="500" step="1" value="10" required>
            <small>Members receive the role after reaching this level.</small>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>Active rewards</h3>
        <div class="reward-list">
          ${rewards.map(reward => `
            <div class="reward-row">
              <div>
                <strong>${escapeHtml(labelFor(metadata.roles, reward.role_id, `Role ${reward.role_id}`))}</strong>
                <span>Level ${escapeHtml(formatCount(reward.required_level))}</span>
              </div>
              <button class="button-secondary compact-button reward-remove-button" type="button" data-role-id="${escapeHtml(reward.role_id)}">Remove</button>
            </div>
          `).join('') || renderEmpty('No reward roles configured yet.', 'Choose a role and required level above to start automation.')}
        </div>
      </section>

      ${renderStatusMessage(uiState.rewardMessage, uiState.rewardTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Reward Role</button>
      </div>
    </form>
  `);

  const form = qs('#reward-settings-form');
  if (form) form.addEventListener('submit', handleRewardSettingsSubmit);
  document.querySelectorAll('.reward-remove-button').forEach(button => {
    button.addEventListener('click', handleRewardRemoveClick);
  });
}

function renderTeamSettings() {
  const teamRoles = getTeamRoles();
  const metadata = getMetadata();

  html('#team-settings', `
    <div class="panel-note">Configure the team roles shown by /team. Members can choose one active team role at a time.</div>
    <form id="team-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Add or update team</h3>
        <div class="form-grid">
          <label class="field">
            <span>Team label</span>
            <input type="text" name="teamLabel" maxlength="60" placeholder="Armor, Infantry, Recon..." required>
            <small>This is the label members see in /team.</small>
          </label>

          <label class="field">
            <span>Team role</span>
            <select name="teamRoleId" required>${selectOptions(metadata.roles, '', 'Choose a team role')}</select>
            <small>The Discord role assigned when members choose this team.</small>
          </label>

          <label class="field">
            <span>Sort order</span>
            <input type="number" name="teamSortOrder" step="1" value="0">
            <small>Lower numbers appear first.</small>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>Active teams</h3>
        <div class="reward-list">
          ${teamRoles.map(team => `
            <div class="reward-row">
              <div>
                <strong>${escapeHtml(team.label)}</strong>
                <span>${escapeHtml(labelFor(metadata.roles, team.roleId, `Role ${team.roleId}`))} - order ${escapeHtml(formatCount(team.sortOrder || 0))}</span>
              </div>
              <button class="button-secondary compact-button team-remove-button" type="button" data-option-key="${escapeHtml(team.optionKey)}">Remove</button>
            </div>
          `).join('') || renderEmpty('No team roles configured yet.', 'Add the first team role above and members can choose it with /team.')}
        </div>
      </section>

      ${renderStatusMessage(uiState.teamMessage, uiState.teamTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Team Role</button>
      </div>
    </form>
  `);

  const form = qs('#team-settings-form');
  if (form) form.addEventListener('submit', handleTeamSettingsSubmit);
  document.querySelectorAll('.team-remove-button').forEach(button => {
    button.addEventListener('click', handleTeamRemoveClick);
  });
}

function renderPublicRoleSettings() {
  const publicRoles = getPublicRoles();
  const metadata = getMetadata();

  html('#public-role-settings', `
    <div class="panel-note">Configure optional roles shown in the permanent #roles panel. Members react with the emoji to add the role and remove the reaction to remove it.</div>
    <form id="public-role-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Add or update role</h3>
        <div class="form-grid">
          <label class="field">
            <span>Menu label</span>
            <input type="text" name="publicRoleLabel" maxlength="60" placeholder="Events, Vietnam, PC..." required>
            <small>This is the label members see in the roles menu.</small>
          </label>

          <label class="field">
            <span>Discord role</span>
            <select name="publicRoleId" required>${selectOptions(metadata.roles, '', 'Choose a role')}</select>
            <small>The role assigned when members select this option.</small>
          </label>

          <label class="field">
            <span>Emoji</span>
            <input type="text" name="publicRoleEmoji" maxlength="80" placeholder="🎮" required>
            <small>Use a standard emoji or paste a custom emoji mention.</small>
          </label>

          <label class="field">
            <span>Sort order</span>
            <input type="number" name="publicRoleSortOrder" step="1" value="0">
            <small>Lower numbers appear first.</small>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>Active role menu options</h3>
        <div class="reward-list">
          ${publicRoles.map(role => `
            <div class="reward-row">
              <div>
                <strong>${escapeHtml(role.emoji || '')} ${escapeHtml(role.label)}</strong>
                <span>${escapeHtml(labelFor(metadata.roles, role.roleId, `Role ${role.roleId}`))} - order ${escapeHtml(formatCount(role.sortOrder || 0))}</span>
              </div>
              <button class="button-secondary compact-button public-role-remove-button" type="button" data-option-key="${escapeHtml(role.optionKey)}">Remove</button>
            </div>
          `).join('') || renderEmpty('No public roles configured yet.', 'Add roles here and the bot will show them in the permanent roles panel.')}
        </div>
      </section>

      ${renderStatusMessage(uiState.publicRoleMessage, uiState.publicRoleTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Role Option</button>
      </div>
    </form>
  `);

  const form = qs('#public-role-settings-form');
  if (form) form.addEventListener('submit', handlePublicRoleSettingsSubmit);
  document.querySelectorAll('.public-role-remove-button').forEach(button => {
    button.addEventListener('click', handlePublicRoleRemoveClick);
  });
}

function renderOnboardingSettings() {
  const onboarding = getOnboarding();
  const community = getCommunitySettings();
  const metadata = getMetadata();

  html('#onboarding-settings', `
    <div class="panel-note">Use Discord Onboarding for platform, region, skill, and channel role choices when possible. These mappings are only used by the bot's fallback role panel; the coach role can still be used when Discord assigns the Medium and Expert roles.</div>
    <form id="onboarding-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Fallback skill roles</h3>
        <div class="form-grid">
          ${SKILL_OPTIONS.map(([key, label]) => `
            <label class="field">
              <span>${escapeHtml(label)}</span>
              <select name="skill-${escapeHtml(key)}" required>
                ${selectOptions(metadata.roles, onboarding.skillRoles?.[key], `Choose the ${label.toLowerCase()} role`)}
              </select>
              <small>Only used when bot role onboarding is enabled.</small>
            </label>
          `).join('')}
        </div>
      </section>

      <section class="settings-section">
        <h3>Helper routing</h3>
        <div class="form-grid">
          <label class="field field-span-2">
            <span>Helper role</span>
            <select name="coachRoleId">${selectOptions(metadata.roles, community.coach_role_id, 'Choose the helper role')}</select>
            <small>Medium and Expert members can opt into this so Beginners know who they can ask for help.</small>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>Fallback region roles</h3>
        <div class="form-grid regions-grid">
          ${REGION_OPTIONS.map(([key, label]) => `
            <label class="field">
              <span>${escapeHtml(label)}</span>
              <select name="region-${escapeHtml(key)}">
                ${selectOptions(metadata.roles, onboarding.regionRoles?.[key], `Optional ${label} role`)}
              </select>
              <small>Only used when bot role onboarding is enabled.</small>
            </label>
          `).join('')}
        </div>
      </section>

      ${renderStatusMessage(uiState.onboardingMessage, uiState.onboardingTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Role Settings</button>
      </div>
    </form>
  `);

  const form = qs('#onboarding-settings-form');
  if (form) form.addEventListener('submit', handleOnboardingSettingsSubmit);
}

function renderSettings() {
  renderReadiness();
  renderBotSettings();
  renderLevelingSettings();
  renderCommunitySettings();
  renderGallerySettings();
  renderTicketSettings();
  renderRewardSettings();
  renderTeamSettings();
  renderPublicRoleSettings();
  renderOnboardingSettings();
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }

  return payload;
}

async function fetchJson(url) {
  return apiRequest(url);
}

async function refreshSettingsView() {
  state.settings = await fetchJson('/api/settings');
  renderEvents();
  renderSettings();
}

async function handleEventCreateSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.eventMessage = 'Posting event...';
  uiState.eventTone = 'info';
  renderEventComposer();

  try {
    button.disabled = true;
    button.textContent = 'Creating...';

    const payload = {
      title: form.elements.title.value.trim(),
      startsAt: form.elements.startsAt.value,
      timeZone: form.elements.timeZone.value,
      description: form.elements.description.value.trim(),
      externalUrl: form.elements.externalUrl.value.trim(),
      imageUrl: form.elements.imageUrl.value.trim()
    };

    await apiRequest('/api/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const eventChannelLabel = labelFor(getMetadata().channels, getCommunitySettings().event_channel_id, 'the configured event channel');
    uiState.eventMessage = `Event posted to ${eventChannelLabel}.`;
    uiState.eventTone = 'success';
    await refresh();
  } catch (error) {
    console.error(error);
    uiState.eventMessage = error.message;
    uiState.eventTone = 'error';
    renderEventComposer();
  } finally {
    const refreshedButton = qs('#event-create-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handleBotSettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.botMessage = 'Saving bot settings...';
  uiState.botTone = 'info';
  renderSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    await apiRequest('/api/settings/bot', {
      method: 'PUT',
      body: JSON.stringify({
        welcomeEnabled: form.elements.welcomeEnabled.checked,
        welcomeChannelId: form.elements.welcomeChannelId.value,
        rolePanelChannelId: form.elements.rolePanelChannelId.value
      })
    });

    uiState.botMessage = 'Bot settings saved.';
    uiState.botTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.botMessage = error.message;
    uiState.botTone = 'error';
    renderSettings();
  } finally {
    const refreshedButton = qs('#bot-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handleTestWelcomeClick() {
  const button = qs('#test-welcome-button');
  const originalLabel = button ? button.textContent : 'Send Test Welcome';

  uiState.botMessage = 'Sending test welcome...';
  uiState.botTone = 'info';
  renderSettings();

  try {
    const refreshedButton = qs('#test-welcome-button');
    if (refreshedButton) {
      refreshedButton.disabled = true;
      refreshedButton.textContent = 'Sending...';
    }

    const result = await apiRequest('/api/settings/bot/test-welcome', {
      method: 'POST',
      body: JSON.stringify({})
    });

    uiState.botMessage = `Test welcome sent to channel ${result.channelId}.`;
    uiState.botTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.botMessage = error.message;
    uiState.botTone = 'error';
    renderSettings();
  } finally {
    const finalButton = qs('#test-welcome-button');
    if (finalButton) {
      finalButton.disabled = false;
      finalButton.textContent = originalLabel;
    }
  }
}

async function handleLevelingSettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.levelingMessage = 'Saving leveling settings...';
  uiState.levelingTone = 'info';
  renderSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    await apiRequest('/api/settings/leveling', {
      method: 'PUT',
      body: JSON.stringify({
        levelingEnabled: form.elements.levelingEnabled.checked,
        textXpEnabled: form.elements.textXpEnabled.checked,
        voiceXpEnabled: form.elements.voiceXpEnabled.checked,
        dmLevelupEnabled: form.elements.dmLevelupEnabled.checked,
        levelupChannelId: form.elements.levelupChannelId.value,
        infoChannelId: form.elements.infoChannelId.value
      })
    });

    uiState.levelingMessage = 'Leveling settings saved.';
    uiState.levelingTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.levelingMessage = error.message;
    uiState.levelingTone = 'error';
    renderSettings();
  } finally {
    const refreshedButton = qs('#leveling-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handleCommunitySettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.communityMessage = 'Saving community settings...';
  uiState.communityTone = 'info';
  renderSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    const payload = {
      onboardingEnabled: form.elements.onboardingEnabled.checked,
      eventEnabled: form.elements.eventEnabled.checked,
      videoEnabled: form.elements.videoEnabled.checked,
      spotlightEnabled: form.elements.spotlightEnabled.checked,
      anniversaryEnabled: form.elements.anniversaryEnabled.checked,
      weeklyRecapEnabled: form.elements.weeklyRecapEnabled.checked,
      softModerationEnabled: form.elements.softModerationEnabled.checked,
      communityChannelId: form.elements.communityChannelId.value,
      mediaChannelId: form.elements.mediaChannelId.value,
      eventChannelId: form.elements.eventChannelId.value,
      videoChannelId: form.elements.videoChannelId.value,
      spotlightChannelId: form.elements.spotlightChannelId.value,
      moderationLogChannelId: form.elements.moderationLogChannelId.value,
      spotlightRoleId: form.elements.spotlightRoleId.value,
      eventRoleId: form.elements.eventRoleId.value,
      weeklyRecapNote: form.elements.weeklyRecapNote.value
    };

    await apiRequest('/api/settings/community', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    uiState.communityMessage = 'Community settings saved.';
    uiState.communityTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.communityMessage = error.message;
    uiState.communityTone = 'error';
    renderSettings();
  } finally {
    const refreshedButton = qs('#community-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handleGallerySettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.galleryMessage = 'Saving gallery settings...';
  uiState.galleryTone = 'info';
  renderSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    await apiRequest('/api/settings/gallery', {
      method: 'PUT',
      body: JSON.stringify({
        galleryEnabled: form.elements.galleryEnabled.checked,
        showcaseChannelId: form.elements.showcaseChannelId.value,
        memeChannelId: form.elements.memeChannelId.value,
        galleryLogChannelId: form.elements.galleryLogChannelId.value
      })
    });

    uiState.galleryMessage = 'Gallery settings saved.';
    uiState.galleryTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.galleryMessage = error.message;
    uiState.galleryTone = 'error';
    renderSettings();
  } finally {
    const refreshedButton = qs('#gallery-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handleGalleryTagAddClick() {
  const form = qs('#gallery-settings-form');
  if (!form) return;

  uiState.galleryTagMessage = 'Adding gallery tag...';
  uiState.galleryTagTone = 'info';
  renderSettings();

  try {
    await apiRequest('/api/settings/gallery-tags', {
      method: 'POST',
      body: JSON.stringify({
        name: form.elements.tagName.value,
        category: form.elements.tagCategory.value
      })
    });

    uiState.galleryTagMessage = 'Gallery tag saved.';
    uiState.galleryTagTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.galleryTagMessage = error.message;
    uiState.galleryTagTone = 'error';
    renderSettings();
  }
}

async function handleGalleryTagRemoveClick(event) {
  const tagName = event.currentTarget.dataset.tagName;
  if (!tagName) return;

  uiState.galleryTagMessage = 'Removing gallery tag...';
  uiState.galleryTagTone = 'info';
  renderSettings();

  try {
    await apiRequest(`/api/settings/gallery-tags/${encodeURIComponent(tagName)}`, {
      method: 'DELETE'
    });

    uiState.galleryTagMessage = 'Gallery tag removed.';
    uiState.galleryTagTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.galleryTagMessage = error.message;
    uiState.galleryTagTone = 'error';
    renderSettings();
  }
}

async function handleTicketSettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.ticketSettingsMessage = 'Saving ticket settings...';
  uiState.ticketSettingsTone = 'info';
  renderSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    await apiRequest('/api/settings/tickets', {
      method: 'PUT',
      body: JSON.stringify({
        ticketsEnabled: form.elements.ticketsEnabled.checked,
        ticketCategoryId: form.elements.ticketCategoryId.value,
        ticketLogChannelId: form.elements.ticketLogChannelId.value,
        supportRoleId: form.elements.supportRoleId.value
      })
    });

    uiState.ticketSettingsMessage = 'Ticket settings saved.';
    uiState.ticketSettingsTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.ticketSettingsMessage = error.message;
    uiState.ticketSettingsTone = 'error';
    renderSettings();
  } finally {
    const refreshedButton = qs('#ticket-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handleRewardSettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.rewardMessage = 'Saving reward role...';
  uiState.rewardTone = 'info';
  renderSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    await apiRequest('/api/settings/rewards', {
      method: 'POST',
      body: JSON.stringify({
        roleId: form.elements.roleId.value,
        requiredLevel: form.elements.requiredLevel.value
      })
    });

    uiState.rewardMessage = 'Reward role saved.';
    uiState.rewardTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.rewardMessage = error.message;
    uiState.rewardTone = 'error';
    renderSettings();
  } finally {
    const refreshedButton = qs('#reward-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handleRewardRemoveClick(event) {
  const button = event.currentTarget;
  const roleId = button.dataset.roleId;
  if (!roleId) return;

  uiState.rewardMessage = 'Removing reward role...';
  uiState.rewardTone = 'info';
  renderSettings();

  try {
    await apiRequest(`/api/settings/rewards/${encodeURIComponent(roleId)}`, {
      method: 'DELETE'
    });

    uiState.rewardMessage = 'Reward role removed.';
    uiState.rewardTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.rewardMessage = error.message;
    uiState.rewardTone = 'error';
    renderSettings();
  }
}

async function handleTeamSettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.teamMessage = 'Saving team role...';
  uiState.teamTone = 'info';
  renderSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    await apiRequest('/api/settings/team-roles', {
      method: 'POST',
      body: JSON.stringify({
        label: form.elements.teamLabel.value,
        roleId: form.elements.teamRoleId.value,
        sortOrder: form.elements.teamSortOrder.value
      })
    });

    uiState.teamMessage = 'Team role saved.';
    uiState.teamTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.teamMessage = error.message;
    uiState.teamTone = 'error';
    renderSettings();
  } finally {
    const refreshedButton = qs('#team-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handleTeamRemoveClick(event) {
  const optionKey = event.currentTarget.dataset.optionKey;
  if (!optionKey) return;

  uiState.teamMessage = 'Removing team role...';
  uiState.teamTone = 'info';
  renderSettings();

  try {
    await apiRequest(`/api/settings/team-roles/${encodeURIComponent(optionKey)}`, {
      method: 'DELETE'
    });

    uiState.teamMessage = 'Team role removed.';
    uiState.teamTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.teamMessage = error.message;
    uiState.teamTone = 'error';
    renderSettings();
  }
}

async function handlePublicRoleSettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.publicRoleMessage = 'Saving role option...';
  uiState.publicRoleTone = 'info';
  renderSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    await apiRequest('/api/settings/public-roles', {
      method: 'POST',
      body: JSON.stringify({
        label: form.elements.publicRoleLabel.value,
        roleId: form.elements.publicRoleId.value,
        emoji: form.elements.publicRoleEmoji.value,
        sortOrder: form.elements.publicRoleSortOrder.value
      })
    });

    uiState.publicRoleMessage = 'Role option saved.';
    uiState.publicRoleTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.publicRoleMessage = error.message;
    uiState.publicRoleTone = 'error';
    renderSettings();
  } finally {
    const refreshedButton = qs('#public-role-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handlePublicRoleRemoveClick(event) {
  const optionKey = event.currentTarget.dataset.optionKey;
  if (!optionKey) return;

  uiState.publicRoleMessage = 'Removing role option...';
  uiState.publicRoleTone = 'info';
  renderSettings();

  try {
    await apiRequest(`/api/settings/public-roles/${encodeURIComponent(optionKey)}`, {
      method: 'DELETE'
    });

    uiState.publicRoleMessage = 'Role option removed.';
    uiState.publicRoleTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.publicRoleMessage = error.message;
    uiState.publicRoleTone = 'error';
    renderSettings();
  }
}

async function handleOnboardingSettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.onboardingMessage = 'Saving onboarding roles...';
  uiState.onboardingTone = 'info';
  renderSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    const skillRoles = Object.fromEntries(
      SKILL_OPTIONS.map(([key]) => [key, form.elements[`skill-${key}`].value])
    );

    const regionRoles = Object.fromEntries(
      REGION_OPTIONS.map(([key]) => [key, form.elements[`region-${key}`].value])
    );

    await apiRequest('/api/settings/onboarding', {
      method: 'PUT',
      body: JSON.stringify({
        skillRoles,
        regionRoles,
        coachRoleId: form.elements.coachRoleId.value
      })
    });

    uiState.onboardingMessage = 'Onboarding roles saved.';
    uiState.onboardingTone = 'success';
    await refreshSettingsView();
  } catch (error) {
    console.error(error);
    uiState.onboardingMessage = error.message;
    uiState.onboardingTone = 'error';
    renderSettings();
  } finally {
    const refreshedButton = qs('#onboarding-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function refresh() {
  setRefreshState(true);

  const requests = [
    ['Overview', fetchJson('/api/overview')],
    ['Events', fetchJson('/api/events')],
    ['Content', fetchJson('/api/content')],
    ['Tickets', fetchJson('/api/tickets')],
    ['Analytics', fetchJson('/api/analytics')],
    ['Settings', fetchJson('/api/settings')]
  ];

  try {
    const results = await Promise.allSettled(requests.map(([, request]) => request));
    const failures = [];

    results.forEach((result, index) => {
      const [label] = requests[index];
      if (result.status !== 'fulfilled') {
        console.error(`${label} refresh failed`, result.reason);
        failures.push(label);
        return;
      }

      const payload = result.value;
      switch (label) {
        case 'Overview':
          state.overview = payload;
          break;
        case 'Events':
          state.events = payload.events || [];
          break;
        case 'Content':
          state.content = payload;
          break;
        case 'Tickets':
          state.tickets = payload.tickets || [];
          break;
        case 'Analytics':
          state.analytics = payload.trends || [];
          break;
        case 'Settings':
          state.settings = payload;
          break;
        default:
          break;
      }
    });

    renderOverview();
    renderEvents();
    renderContent();
    renderTickets();
    renderAnalytics();
    renderSettings();

    if (failures.length) {
      const label = failures.length === 1 ? failures[0] : `${failures.length} sections`;
      setStatus(`Updated with warnings. ${label} did not refresh cleanly. Check dashboard logs if this keeps happening.`, true);
      return;
    }

    setStatus(`Updated ${formatDateTime(new Date())}`);
  } finally {
    setRefreshState(false);
  }
}
function setView(view) {
  document.querySelectorAll('.view').forEach(element => {
    element.classList.toggle('active', element.id === view);
  });
  document.querySelectorAll('.nav-item').forEach(element => {
    element.classList.toggle('active', element.dataset.view === view);
  });

  const [title, subtitle] = viewTitles[view];
  text('#view-title', title);
  text('#view-subtitle', subtitle);
}

document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

qs('#refresh-button').addEventListener('click', () => {
  refresh().catch(() => {});
});

refresh().catch(() => {});
