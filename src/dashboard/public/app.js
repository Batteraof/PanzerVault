const viewTitles = {
  overview: ['Overview', 'Community pulse and next actions'],
  events: ['Events', 'Create new sessions and watch RSVP flow'],
  content: ['Content', 'Gallery posts, videos, and contributor output'],
  tickets: ['Tickets', 'Categories, status, and response time'],
  analytics: ['Analytics', 'Activity trends and participation'],
  settings: ['Configuration', 'Live bot settings and onboarding role mapping']
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
  communityMessage: '',
  communityTone: 'info',
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

function getCommunitySettings() {
  return state.settings?.communitySettings || {};
}

function getMetadata() {
  return state.settings?.metadata || { channels: [], roles: [] };
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
          <small>Use your local time; the bot stores it in the database correctly.</small>
        </label>

        <label class="field">
          <span>Optional link</span>
          <input type="url" name="externalUrl" placeholder="https://...">
          <small>Briefings, sign-up sheets, or external event notes.</small>
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

function renderCommunitySettings() {
  const community = getCommunitySettings();
  const metadata = getMetadata();

  html('#community-settings', `
    <div class="panel-note">Use this to steer where the bot posts and which community systems are currently active. These values map to the same live settings rows used by the Discord-side config flow.</div>
    <form id="community-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Feature toggles</h3>
        <div class="toggle-grid">
          ${renderToggleControl('onboardingEnabled', 'Onboarding flow', 'Keep rules verification and onboarding prompts active.', community.onboarding_enabled !== false)}
          ${renderToggleControl('eventEnabled', 'Events', 'Allow RSVP events and reminders to run.', community.event_enabled !== false)}
          ${renderToggleControl('videoEnabled', 'Video submissions', 'Accept curated YouTube posts through /video.', community.video_enabled !== false)}
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
            <span>Event channel</span>
            <select name="eventChannelId">${selectOptions(metadata.channels, community.event_channel_id, 'Choose an event channel')}</select>
            <small>New dashboard-created events post their RSVP embeds here.</small>
          </label>

          <label class="field">
            <span>Video channel</span>
            <select name="videoChannelId">${selectOptions(metadata.channels, community.video_channel_id, 'Choose a video channel')}</select>
            <small>The /video command sends curated YouTube posts here.</small>
          </label>

          <label class="field">
            <span>Spotlight channel</span>
            <select name="spotlightChannelId">${selectOptions(metadata.channels, community.spotlight_channel_id, 'Choose a spotlight channel')}</select>
            <small>The monthly spotlight winner and archive live here.</small>
          </label>

          <label class="field field-span-2">
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
        </div>
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

function renderOnboardingSettings() {
  const onboarding = getOnboarding();
  const community = getCommunitySettings();
  const metadata = getMetadata();

  html('#onboarding-settings', `
    <div class="panel-note">These mappings drive the join flow right after rules acceptance. Skill roles are required; region roles and coach role can stay empty until the server owner finalizes them.</div>
    <form id="onboarding-settings-form" class="form-stack">
      <section class="settings-section">
        <h3>Skill roles</h3>
        <div class="form-grid">
          ${SKILL_OPTIONS.map(([key, label]) => `
            <label class="field">
              <span>${escapeHtml(label)}</span>
              <select name="skill-${escapeHtml(key)}" required>
                ${selectOptions(metadata.roles, onboarding.skillRoles?.[key], `Choose the ${label.toLowerCase()} role`)}
              </select>
              <small>Members choose one of these during onboarding.</small>
            </label>
          `).join('')}
        </div>
      </section>

      <section class="settings-section">
        <h3>Coach routing</h3>
        <div class="form-grid">
          <label class="field field-span-2">
            <span>Coach role</span>
            <select name="coachRoleId">${selectOptions(metadata.roles, community.coach_role_id, 'Choose the coach / teacher role')}</select>
            <small>Medium and Expert members can opt into this so Beginners know who they can ping for help.</small>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>Region roles</h3>
        <div class="form-grid regions-grid">
          ${REGION_OPTIONS.map(([key, label]) => `
            <label class="field">
              <span>${escapeHtml(label)}</span>
              <select name="region-${escapeHtml(key)}">
                ${selectOptions(metadata.roles, onboarding.regionRoles?.[key], `Optional ${label} role`)}
              </select>
              <small>Leave blank until the server owner is ready for this region role.</small>
            </label>
          `).join('')}
        </div>
      </section>

      ${renderStatusMessage(uiState.onboardingMessage, uiState.onboardingTone)}

      <div class="action-row">
        <button class="button-primary" type="submit">Save Onboarding Roles</button>
      </div>
    </form>
  `);

  const form = qs('#onboarding-settings-form');
  if (form) form.addEventListener('submit', handleOnboardingSettingsSubmit);
}

function renderSettings() {
  renderCommunitySettings();
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
      description: form.elements.description.value.trim(),
      externalUrl: form.elements.externalUrl.value.trim()
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

async function handleCommunitySettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.communityMessage = 'Saving community settings...';
  uiState.communityTone = 'info';
  renderCommunitySettings();

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
      eventChannelId: form.elements.eventChannelId.value,
      videoChannelId: form.elements.videoChannelId.value,
      spotlightChannelId: form.elements.spotlightChannelId.value,
      moderationLogChannelId: form.elements.moderationLogChannelId.value,
      spotlightRoleId: form.elements.spotlightRoleId.value
    };

    const result = await apiRequest('/api/settings/community', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    state.settings = {
      ...state.settings,
      communitySettings: result.settings
    };

    uiState.communityMessage = 'Community settings saved.';
    uiState.communityTone = 'success';
    renderEvents();
    renderCommunitySettings();
  } catch (error) {
    console.error(error);
    uiState.communityMessage = error.message;
    uiState.communityTone = 'error';
    renderCommunitySettings();
  } finally {
    const refreshedButton = qs('#community-settings-form button[type="submit"]');
    if (refreshedButton) {
      refreshedButton.disabled = false;
      refreshedButton.textContent = originalLabel;
    }
  }
}

async function handleOnboardingSettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;

  uiState.onboardingMessage = 'Saving onboarding roles...';
  uiState.onboardingTone = 'info';
  renderOnboardingSettings();

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    const skillRoles = Object.fromEntries(
      SKILL_OPTIONS.map(([key]) => [key, form.elements[`skill-${key}`].value])
    );

    const regionRoles = Object.fromEntries(
      REGION_OPTIONS.map(([key]) => [key, form.elements[`region-${key}`].value])
    );

    const result = await apiRequest('/api/settings/onboarding', {
      method: 'PUT',
      body: JSON.stringify({
        skillRoles,
        regionRoles,
        coachRoleId: form.elements.coachRoleId.value
      })
    });

    state.settings = {
      ...state.settings,
      communitySettings: result.communitySettings,
      onboarding: result.onboarding
    };

    uiState.onboardingMessage = 'Onboarding roles saved.';
    uiState.onboardingTone = 'success';
    renderEvents();
    renderOnboardingSettings();
  } catch (error) {
    console.error(error);
    uiState.onboardingMessage = error.message;
    uiState.onboardingTone = 'error';
    renderOnboardingSettings();
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

  try {
    const [overview, events, content, tickets, analytics, settings] = await Promise.all([
      fetchJson('/api/overview'),
      fetchJson('/api/events'),
      fetchJson('/api/content'),
      fetchJson('/api/tickets'),
      fetchJson('/api/analytics'),
      fetchJson('/api/settings')
    ]);

    state.overview = overview;
    state.events = events.events || [];
    state.content = content;
    state.tickets = tickets.tickets || [];
    state.analytics = analytics.trends || [];
    state.settings = settings;

    renderOverview();
    renderEvents();
    renderContent();
    renderTickets();
    renderAnalytics();
    renderSettings();
    setStatus(`Updated ${formatDateTime(new Date())}`);
  } catch (error) {
    console.error(error);
    setStatus('Refresh failed. Check dashboard logs.', true);
    throw error;
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