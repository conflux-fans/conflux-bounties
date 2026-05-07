import pg from 'pg';

const { Pool } = pg;

/**
 * PostgreSQL connection pool shared across the ingestor process.
 * Configured via environment variables.
 */
export const pool = new Pool({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? 'conflux_analytics',
  user: process.env.POSTGRES_USER ?? 'analytics',
  password: process.env.POSTGRES_PASSWORD ?? 'analytics_secret',
  max: 20,
});

/** Graceful shutdown helper */
export async function closePool(): Promise<void> {
  await pool.end();
}
