# Discord Leveling Bot

CommonJS Discord.js v14 bot with the existing welcome embed, role selection panel, button/select interactions, `!ping`, and a PostgreSQL-backed leveling foundation.

## What Changed

- Preserved custom interaction IDs: `join_info`, `roles_menu`, `role_select`.
- Preserved the original role IDs and welcome channel defaults.
- Added PostgreSQL migrations and repositories.
- Added text XP, voice XP, streak persistence, XP audit logs, achievements foundation, and `/rank`.
- Added curated `/gallery submit`, `/gallery remove`, and `/gallery tags`.
- Added restart-safe voice session recovery for VPS hosting.
- Added laptop-friendly runtime defaults for local always-on hosting.

## Setup

1. Install Node.js 20+ and PostgreSQL.
2. Copy `.env.example` to `.env` and fill in `TOKEN`, `DATABASE_URL`, and `CLIENT_ID`.
3. Install dependencies:

```bash
npm install
```

4. Run migrations:

```bash
npm run migrate
```

5. Register `/rank` for your guild:

```bash
npm run commands:register
```

6. Start the bot:

```bash
npm start
```

## Local Laptop Hosting

The current default profile is for an old laptop running locally:

```env
HOSTING_PROFILE=laptop
DB_POOL_MAX=3
DB_IDLE_TIMEOUT_MS=10000
VOICE_TRACKING_INTERVAL_MS=120000
```

Run locally:

```bash
npm install
npm run migrate
npm run commands:register
npm start
```

For always-on notes on Windows, PM2, Task Scheduler, NSSM, and Linux, see [docs/laptop-hosting.md](docs/laptop-hosting.md).

## Optional Oracle Cloud Ubuntu With PM2

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql
sudo npm install -g pm2
npm install
npm run migrate
npm run commands:register
pm2 start src/index.js --name discord-leveling-bot
pm2 save
pm2 startup
```

## Required Discord Intents

Enable these in the Discord developer portal:

- Server Members Intent
- Message Content Intent

The code uses these gateway intents:

- `Guilds`
- `GuildMessages`
- `MessageContent`
- `GuildMembers`
- `GuildVoiceStates`

`GuildVoiceStates` is the only new intent required for the leveling foundation. It lets the bot track joins, leaves, channel switches, and self-deafen changes for voice XP.

## Leveling Rules

Text XP:

- 15 second PostgreSQL-backed cooldown.
- 1-3 words: 1 XP.
- 4-5 words: 3 XP.
- 6-15 words: 8 XP.
- 16+ words: 12 XP.

Voice XP:

- 1 XP per 2 eligible minutes.
- No XP in AFK channels.
- No XP while alone.
- No XP while self-deafened for the measured interval.
- No session bonuses or multipliers.

Level curve:

```text
xpForNextLevel(L) = 100 + 35 * L^2
```

The maximum level is 500.

## Voice Restart Recovery

On startup, the bot loads active `voice_sessions`.

- If Discord still shows the member in the same voice channel, the session is kept and `last_checked_at` is advanced to startup time.
- If the member is gone, the session is closed as `stale`.
- If the member moved while the bot was offline, the old session is closed as `stale` and a new session starts from startup time.

The bot intentionally does not award XP for downtime while it was offline because it cannot safely prove whether the user was alone, AFK, or self-deafened during that interval. This favors no double-awards and clean recovery over speculative XP.

## Gallery

The gallery is separate from leveling. Submissions do not grant XP, do not affect streaks, and do not assign rewards.

Configure these env vars before first startup, or update `gallery_settings` in PostgreSQL later:

```bash
GALLERY_SHOWCASE_CHANNEL_ID=123
GALLERY_MEME_CHANNEL_ID=456
GALLERY_LOG_CHANNEL_ID=789
```

Commands:

```bash
/gallery submit
/gallery tags
/gallery remove
/gallery blacklist
/gallery unblacklist
```

`/gallery submit` accepts:

- `category`: `showcase` or `meme`
- `image_1` through `image_5`: PNG/JPG only
- `caption`: optional, max 300 characters, Discord mentions rejected
- `video_link`: optional YouTube URL only
- `tags`: optional comma-separated approved tags

Tag UX is intentionally simple for V1: a comma-separated string is validated against approved tags in PostgreSQL. Initial tags are seeded per guild: `US Tanks`, `GER Tanks`, `USSR Tanks`. The schema supports active/inactive tags and category-specific tag availability later.

Multiple images are posted as one message with up to five embeds. The bot re-uploads the submitted Discord attachments to the gallery message and references them via `attachment://...`, which keeps the public post self-contained.

Moderation model:

- Valid submissions are auto-posted immediately.
- Moderators with Manage Messages or Manage Server can remove by submission ID or gallery message ID.
- Moderators with Manage Messages or Manage Server can blacklist or unblacklist users from gallery submissions.
- Removals update PostgreSQL, attempt to delete the public message, and log to the configured gallery log channel.
- If a gallery message is deleted directly in Discord and the bot receives the delete event, the matching DB submission is marked removed and logged.

Historical moderation standard:

- Allowed: historical WW2/game-related context, faction-based gameplay screenshots, and relevant community creations.
- Not allowed: extremist glorification, propaganda-style posting, hate-oriented or provocative ideological captions, or abuse disguised as historical content.
- The bot validates format, tags, mentions, and rate limits; staff handle context-sensitive moderation.

Gallery rate limits are persisted in PostgreSQL:

- 1 submission every 6 hours per user
- max 3 submissions per rolling 24 hours

## Admin Config Commands

Register slash commands after deploying changes:

```bash
npm run commands:register
```

Admin commands require Manage Server unless noted otherwise.

```bash
/config welcome channel
/config welcome enabled
/config leveling channel
/config leveling enabled
/config leveling text-xp
/config leveling voice-xp
/config leveling dm-levelups
/config gallery showcase-channel
/config gallery meme-channel
/config gallery log-channel
/config gallery enabled
/config gallery add-tag
/config gallery remove-tag
/config rewards add-role
/config rewards remove-role
/config rewards list
/config rewards sync-user
/config tickets category
/config tickets log-channel
/config tickets support-role
/config tickets enabled
```

Rank and profile commands:

```bash
/rank show
/rank reset
/leaderboard
/profile
```

`/rank reset` is admin-only and writes a manual XP audit row.

Reward roles:

- Configure them with `/config rewards add-role`.
- The bot assigns configured reward roles automatically when users level up.
- `/rank reset` syncs reward roles back down after resetting a member.
- `/config rewards sync-user` lets staff sync a member after adding or changing reward roles.
- The bot needs Manage Roles and must be higher than reward roles in the Discord role hierarchy.

Tickets:

```bash
/ticket open
/ticket close
/ticket add
/ticket remove
```

Configure ticket category/log/support role through `/config tickets ...`. The bot needs Manage Channels to create and close ticket channels.

## Phase 2 Ideas

- Gallery restore flow.
- Timed gallery blacklist entries.
- Ticket transcripts.
- Stronger anti-spam similarity checks.
- Configurable achievement definitions.
- Richer level-up embeds.
