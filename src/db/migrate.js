require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('./client');
const logger = require('../logger');

const migrationsDir = path.join(__dirname, 'migrations');

async function ensureMigrationTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations() {
  const result = await db.query('SELECT id FROM schema_migrations');
  return new Set(result.rows.map(row => row.id));
}

async function runMigration(fileName) {
  const migrationId = fileName.replace(/\.sql$/, '');
  const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');

  await db.withTransaction(async client => {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migrationId]);
  });

  logger.info('Applied migration', migrationId);
}

async function migrate() {
  await ensureMigrationTable();
  const applied = await getAppliedMigrations();
  const files = fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const fileName of files) {
    const migrationId = fileName.replace(/\.sql$/, '');
    if (applied.has(migrationId)) continue;
    await runMigration(fileName);
  }

  logger.info('Migrations complete');
}

migrate()
  .catch(error => {
    logger.error('Migration failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });
