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

function qs(selector) {
  return document.querySelector(selector);
}

function text(selector, value) {
  const element = qs(selector);
  if (element) element.textContent = value;
}

function formatDate(value) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(title, meta, pill = '') {
  return `
    <div class="row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <div class="meta">${escapeHtml(meta)}</div>
      </div>
      ${pill ? `<span class="pill">${escapeHtml(pill)}</span>` : ''}
    </div>
  `;
}

function renderOverview() {
  const data = state.overview || {};
  text('#active-users', data.activeUsers || 0);
  text('#event-count', (data.upcomingEvents || []).length);
  text('#open-tickets', data.openTickets || 0);
  text('#content-count', (data.featuredContent || []).length);

  qs('#overview-events').innerHTML = (data.upcomingEvents || []).map(event =>
    row(event.title, `${formatDate(event.starts_at)} · ${event.going_count || 0} going`, 'Event')
  ).join('') || '<div class="empty-state">No upcoming events.</div>';

  qs('#top-contributors').innerHTML = (data.topContributors || []).map(user =>
    row(`User ${user.user_id}`, `Level ${user.level} · ${user.total_xp} XP`, 'XP')
  ).join('') || '<div class="empty-state">No contributor data yet.</div>';
}

function renderEvents() {
  qs('#events-list').innerHTML = state.events.map(event =>
    row(
      event.title,
      `${formatDate(event.starts_at)} · ${event.going_count || 0} going · ${event.attendance_count || 0} checked in`,
      event.status
    )
  ).join('') || '<div class="empty-state">No events found.</div>';
}

function renderContent() {
  const gallery = state.content.gallery.map(item => ({
    title: item.caption || `Gallery #${item.id}`,
    meta: `${item.category} · ${formatDate(item.created_at)}`,
    type: 'Gallery'
  }));
  const videos = state.content.videos.map(item => ({
    title: item.title,
    meta: `${formatDate(item.created_at)} · ${Object.values(item.tags || {}).join(', ') || 'No tags'}`,
    type: 'Video'
  }));

  qs('#content-grid').innerHTML = [...gallery, ...videos].map(item => `
    <article class="content-item">
      <span class="pill">${escapeHtml(item.type)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <div class="tag-line">${escapeHtml(item.meta)}</div>
    </article>
  `).join('') || '<div class="empty-state">No content found.</div>';
}

function renderTickets() {
  const categories = ['support', 'report', 'application', 'event_issue'];
  const labels = {
    support: 'Support',
    report: 'Reports',
    application: 'Applications',
    event_issue: 'Event Issues'
  };

  qs('#ticket-board').innerHTML = categories.map(category => {
    const tickets = state.tickets.filter(ticket => ticket.category === category);
    return `
      <div class="ticket-column">
        <h3>${labels[category]}</h3>
        ${tickets.map(ticket => `
          <article class="ticket-card">
            <span class="pill">${escapeHtml(ticket.status)}</span>
            <strong>#${ticket.id} ${escapeHtml(ticket.subject || 'No subject')}</strong>
            <div class="meta">${Math.round((ticket.response_seconds || 0) / 60)} min response clock</div>
          </article>
        `).join('') || '<div class="empty-state">Clear</div>'}
      </div>
    `;
  }).join('');
}

function renderAnalytics() {
  const max = Math.max(1, ...state.analytics.map(day => day.messages + day.gallery_posts + day.video_posts));
  qs('#analytics-bars').innerHTML = state.analytics.map(day => {
    const total = day.messages + day.gallery_posts + day.video_posts;
    const width = Math.max(4, Math.round((total / max) * 100));
    return `
      <div class="bar-row">
        <span>${formatDate(day.day).split(',')[0]}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <strong>${total}</strong>
      </div>
    `;
  }).join('') || '<div class="empty-state">No analytics yet.</div>';
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function refresh() {
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
  refresh().catch(error => {
    console.error(error);
  });
});

refresh().catch(error => {
  console.error(error);
});
