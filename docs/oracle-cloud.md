# Oracle Cloud Ubuntu Notes

This bot is designed for a normal long-running Ubuntu process on an Oracle Cloud VM. It does not rely on Railway-specific process behavior.

## Runtime

- Ubuntu 22.04 or 24.04.
- Node.js 20+.
- PostgreSQL 14+.
- PM2, systemd, or Docker for process supervision.

## PostgreSQL Example

```bash
sudo -u postgres createuser --pwprompt discord_bot
sudo -u postgres createdb -O discord_bot discord_bot
```

Use the resulting connection string in `.env`:

```bash
DATABASE_URL=postgresql://discord_bot:your_password@127.0.0.1:5432/discord_bot
DB_SSL=false
```

## PM2

```bash
npm install
npm run migrate
npm run commands:register
pm2 start src/index.js --name discord-leveling-bot
pm2 save
pm2 startup
```

## systemd

Copy `docs/discord-bot.service.example` to `/etc/systemd/system/discord-leveling-bot.service`, adjust the paths and user, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable discord-leveling-bot
sudo systemctl start discord-leveling-bot
sudo journalctl -u discord-leveling-bot -f
```

## Docker

```bash
docker build -t discord-leveling-bot .
docker run --env-file .env --restart unless-stopped discord-leveling-bot
```

For production, run PostgreSQL outside the container or with a persistent Docker volume.

## Gallery Channels

Set these in `.env` before first startup so the bot can seed `gallery_settings`:

```bash
GALLERY_SHOWCASE_CHANNEL_ID=
GALLERY_MEME_CHANNEL_ID=
GALLERY_LOG_CHANNEL_ID=
```

After changing slash commands, run:

```bash
npm run commands:register
```

This release adds `/bot`, `/config`, `/leaderboard`, `/profile`, keeps public ticket actions under `/ticket`, moves staff ticket actions to `/ticket-manage`, simplifies public gallery use to `/submit` and `/tags`, keeps gallery moderation under `/gallery`, and moves admin rank resets to `/rank-reset`.

Reward roles require the bot role to have Manage Roles and sit above any configured reward roles. Tickets require Manage Channels.
