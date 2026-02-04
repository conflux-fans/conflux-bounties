import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run all SQL migration files in order against the configured database.
 * Reads every .sql file from db/migrations/ sorted by filename.
 */
async function main() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'conflux_analytics',
    user: process.env.POSTGRES_USER ?? 'analytics',
    password: process.env.POSTGRES_PASSWORD ?? 'analytics_secret',
  });

  const migrationsDir = path.resolve(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  console.log(`[migrate] Running ${files.length} migrations...`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`  Applying ${file}...`);
    await pool.query(sql);
  }

  console.log('[migrate] All migrations applied.');
  await pool.end();
}

main().catch((err) => {
  console.error('[migrate] Error:', err);
  process.exit(1);
});
