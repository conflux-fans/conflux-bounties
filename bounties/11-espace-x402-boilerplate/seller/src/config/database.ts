/**
 * PostgreSQL 16 connection pool
 */

import pg from 'pg';
import { env } from './env.js';

const pool = new pg.Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.pass,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

export { pool as db };
