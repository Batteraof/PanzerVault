# Local Laptop Hosting

This bot is now tuned by default for a small always-on laptop such as a Lenovo IdeaPad 530S-14ARR.

## Recommended Setup

- Keep the laptop plugged in.
- Disable sleep while plugged in.
- Use PostgreSQL locally.
- Run Node.js 20+.
- Keep `HOSTING_PROFILE=laptop` in `.env`.

Laptop-friendly defaults:

```bash
HOSTING_PROFILE=laptop
DB_POOL_MAX=3
DB_IDLE_TIMEOUT_MS=10000
VOICE_TRACKING_INTERVAL_MS=120000
```

These settings reduce idle database connections and cut the voice tracking background loop to once every two minutes. Voice XP still uses elapsed eligible time, so users do not lose XP accuracy; level-up timing may just be slightly less immediate.

## Windows Run Option

Install Node.js and PostgreSQL, then in the bot folder:

```powershell
npm install
npm run migrate
npm run commands:register
npm start
```

For long-running use on Windows, install PM2:

```powershell
npm install -g pm2
pm2 start src/index.js --name discord-leveling-bot
pm2 save
```

PM2 on Windows does not survive reboot as cleanly as Linux by itself. For reboot persistence, use Task Scheduler to run:

```powershell
pm2 resurrect
```

at user login, or use NSSM to run `node src/index.js` as a Windows service.

## Ubuntu/Linux Run Option

```bash
npm install
npm run migrate
npm run commands:register
pm2 start src/index.js --name discord-leveling-bot
pm2 save
pm2 startup
```

## Laptop Health Notes

- Avoid running PostgreSQL with huge shared buffers on an old laptop; the default local install is fine for a 300-member Discord server.
- Do not run multiple bot copies at the same time, because both would process Discord events.
- If the laptop sleeps, the bot disconnects. PostgreSQL persistence keeps XP/gallery/tickets safe, and voice sessions are reconciled on startup.
- If fans or CPU usage become annoying, raise `VOICE_TRACKING_INTERVAL_MS` to `180000`.
