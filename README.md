# PanzerVault Bot

CommonJS Discord.js v14 bot for Tanks Let Loose with:

- welcome flow
- rules verification
- onboarding role selection
- PostgreSQL-backed leveling
- guided gallery submissions
- YouTube video submissions
- tickets
- event RSVPs and reminders
- monthly Community Spotlight
- weekly recap, anniversaries, and soft moderation

The original bot behavior is preserved:

- `join_info`
- `roles_menu`
- `role_select`
- welcome embeds
- self-role flow
- `!ping`

## Stack

- Node.js 20+
- Discord.js v14
- PostgreSQL
- JavaScript / CommonJS
- long-running laptop or VPS hosting with `systemd`

## Setup

1. Copy `.env.example` to `.env`
2. Fill in at least:
   - `TOKEN`
   - `DATABASE_URL`
   - `CLIENT_ID`
   - `GUILD_ID`
3. Install packages:

```bash
npm install
```

4. Run migrations:

```bash
npm run migrate
```

5. Register guild slash commands:

```bash
npm run commands:register
```

6. Start the bot:

```bash
npm start
```

## Laptop Hosting

This repo is tuned for a small always-on laptop by default:

```env
HOSTING_PROFILE=laptop
DB_POOL_MAX=3
DB_IDLE_TIMEOUT_MS=10000
VOICE_TRACKING_INTERVAL_MS=120000
```

Recommended service flow on Ubuntu:

```bash
npm install
npm run migrate
npm run commands:register
sudo systemctl restart discord-bot
```

Useful commands:

```bash
sudo systemctl status discord-bot --no-pager
sudo systemctl restart discord-bot
sudo journalctl -u discord-bot -f
```

## Required Discord Intents

Enable these in the Discord developer portal:

- Server Members Intent
- Message Content Intent

The bot uses:

- `Guilds`
- `GuildMessages`
- `MessageContent`
- `GuildMembers`
- `GuildVoiceStates`

## Public Commands

- `/bot`
- `/rank`
- `/leaderboard`
- `/profile`
- `/submit`
- `/tags`
- `/video`
- `/spotlight`
- `/ticket`

## Staff Commands

- `/config`
- `/gallery`
- `/event`
- `/rank-reset`
- `/spotlight-manage`
- `/ticket-manage`

Staff-only slash commands use default member permissions so normal members should not see them once commands are refreshed.

## Rules And Onboarding

When rules verification is enabled:

- the bot keeps a pinned rules panel in the rules channel
- members click **I Agree** to receive the verified role
- after agreeing, they can immediately choose:
  - skill: `Beginner / Medium / Expert`
  - region: `EU / UK / NA / LATAM / AFRICA / SA / EA / SEA / OCE`
- Medium and Expert members can opt into a coach role
- beginners are told they can ping coaches for help

Important: Discord channel permissions still need to be set so only the verified role can see the full server.

## Leveling

Text XP:

- 15 second cooldown
- 1-3 words: 1 XP
- 4-5 words: 3 XP
- 6-15 words: 8 XP
- 16+ words: 12 XP

Voice XP:

- 1 XP per 2 eligible minutes
- no XP while alone
- no XP in AFK channels
- no XP while fully self-deafened

Curve:

```text
xpForNextLevel(L) = 100 + 35 * L^2
```

Max level: `500`

Progress is stored in PostgreSQL and survives restarts.

## Gallery

Gallery posting is separate from leveling.

- no XP
- no streak gain
- PostgreSQL-backed rate limits
- moderation logs
- DB-backed tags

Public gallery flow:

- `/submit`
- upload `image_1` through `image_5`
- choose category in the guided wizard
- choose approved tags
- add description and optional YouTube link in a modal
- review and post

Gallery categories:

- `showcase`
- `meme`

The bot keeps pinned guide messages in the showcase and meme channels.

Showcase posts can also send a short heads-up in the configured community channel.

## Video Channel

Use `/video` to post a YouTube link into the dedicated video channel.

- title required
- description optional
- YouTube links only
- optional short notification in the main community chat
- no XP for video posts

The bot keeps a pinned guide message in the video channel when it is configured.

## Events

Staff create events with `/event create`.

Each event post includes:

- event title
- date/time
- optional description
- optional external link
- RSVP buttons:
  - Going
  - Maybe
  - Not Going

Reminder cadence:

- 3 days before
- 1 day before

RSVP is shown publicly as counts only.

## Community Spotlight

Monthly spotlight system with:

- member nominations
- member voting
- staff disqualification tools
- staff tie resolution
- dedicated spotlight archive channel
- temporary spotlight role for the winner
- 3-month cooldown before repeat wins

No XP is tied to spotlight.

## Weekly Recap And Anniversaries

The community scheduler can post:

- weekly recap in the community channel
- Discord join anniversaries in the leveling chat

Weekly recap includes:

- message volume
- unique chatters
- new members
- voice hours
- gallery posts
- video posts
- events created
- top active channels
- optional staff note

## Soft Moderation

Soft moderation is lightweight and laptop-safe.

Current scope:

- repeated-message spam
- message flood
- excessive mentions
- obvious link spam

Behavior:

- warn the user
- auto-delete obvious spam
- log the incident to the moderation log channel when configured

## Admin Config

Main config groups:

- `/config welcome ...`
- `/config leveling ...`
- `/config gallery ...`
- `/config onboarding ...`
- `/config community ...`
- `/config rewards ...`
- `/config tickets ...`
- `/config rules ...`

Examples:

- `/config rules channel`
- `/config rules verified-role`
- `/config onboarding skill-role`
- `/config onboarding region-role`
- `/config onboarding coach-role`
- `/config community video-channel`
- `/config community spotlight-channel`
- `/config community spotlight-role`
- `/config community event-channel`
- `/config community moderation-log-channel`
- `/config leveling info-channel`

## Deploy Update Flow

After local code changes:

```bash
git pull
npm install
npm run migrate
npm run commands:register
sudo systemctl restart discord-bot
```

Refresh Discord with `Ctrl + R` after command changes so stale command entries disappear.

## Dashboard Hosting

The admin dashboard is a separate lightweight Express process.

Manual start:

```bash
npm run dashboard
```

Health check:

```bash
curl http://localhost:3000/api/health
```

Recommended `systemd` service example:

- `docs/general-bot-dashboard.service.example`

Typical Ubuntu install flow:

```bash
sudo cp docs/general-bot-dashboard.service.example /etc/systemd/system/general-bot-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable general-bot-dashboard
sudo systemctl start general-bot-dashboard
sudo systemctl status general-bot-dashboard --no-pager
```

Useful dashboard commands:

```bash
sudo systemctl restart general-bot-dashboard
sudo journalctl -u general-bot-dashboard -f
```