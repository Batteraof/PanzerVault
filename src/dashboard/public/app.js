const viewTitles = {
  overview: ['Overview', 'Community pulse and next actions'],
  events: ['Events', 'RSVPs, attendance, and XP configuration'],
  content: ['Content', 'Gallery posts, videos, and tags'],
  tickets: ['Tickets', 'Categories, status, and response time'],
  analytics: ['Analytics', 'Activity trends and participation'],
  roles: ['Roles / Onboarding', 'Skill, region, and onboarding configuration']
};

const state = {
  overview: null,
  events: [],
  content: { gallery: [], videos: [] },
  tickets: [],
  analytics: []
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
    })).join('') || renderEmpty('No upcoming events yet.', 'Create the next session in Discord with /event create so members have something to rally around.')
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

function renderEvents() {
  html(
    '#events-list',
    state.events.map(event => row({
      title: event.title,
      meta: formatDateTime(event.starts_at),
      detail: `${formatCount(event.going_count)} going - ${formatCount(event.maybe_count)} maybe - ${formatCount(event.attendance_count)} checked in`,
      pill: titleCase(event.status || 'scheduled')
    })).join('') || renderEmpty('No events found.', 'Scheduled events will appear here with their RSVP and attendance signal.')
  );
}

function renderContent() {
  const gallery = (state.content.gallery || []).map(item => ({
    kind: 'Gallery',
    title: item.caption || `Gallery #${item.id}`,
    createdAt: item.created_at,
    meta: `${memberName(item)} - ${titleCase(item.category || 'showcase')}`,
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

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function refresh() {
  setRefreshState(true);

  try {
    const [overview, events, content, tickets, analytics] = await Promise.all([
      fetchJson('/api/overview'),
      fetchJson('/api/events'),
      fetchJson('/api/content'),
      fetchJson('/api/tickets'),
      fetchJson('/api/analytics')
    ]);

    state.overview = overview;
    state.events = events.events || [];
    state.content = content;
    state.tickets = tickets.tickets || [];
    state.analytics = analytics.trends || [];

    renderOverview();
    renderEvents();
    renderContent();
    renderTickets();
    renderAnalytics();
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
