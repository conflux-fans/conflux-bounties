import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

/**
 * Generate a new API key and insert it into the database.
 * Usage: pnpm generate-api-key [name]
 */
async function main() {
  const name = process.argv[2] ?? 'default';
  const key = crypto.randomBytes(32).toString('hex');

  const pool = new Pool({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'conflux_analytics',
    user: process.env.POSTGRES_USER ?? 'analytics',
    password: process.env.POSTGRES_PASSWORD ?? 'analytics_secret',
  });

  await pool.query(
    `INSERT INTO api_keys (key, name, rate_limit) VALUES ($1, $2, 100)`,
    [key, name],
  );

  console.log(`[generate-api-key] Created key for "${name}":`);
  console.log(`  ${key}`);

  await pool.end();
}

main().catch((err) => {
  console.error('[generate-api-key] Error:', err);
  process.exit(1);
});
