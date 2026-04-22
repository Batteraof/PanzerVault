const { Pool } = require('pg');
const config = require('../../config');
const logger = require('../../logger');

const pool = new Pool({
  connectionString: config.database.connectionString,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.connectionTimeoutMillis
});

pool.on('error', error => {
  logger.error('Unexpected PostgreSQL client error', error);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function withTransaction(callback) {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function close() {
  await pool.end();
}

module.exports = {
  query,
  getClient,
  withTransaction,
  close
};
