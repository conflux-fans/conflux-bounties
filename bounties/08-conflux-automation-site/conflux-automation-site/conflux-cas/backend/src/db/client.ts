import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database as BetterSQLite3 } from 'better-sqlite3';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

// Resolve relative DATABASE_PATH values from the project root so both
// backend and worker always share the same SQLite file regardless of CWD.
const __dirname = path.dirname(fileURLToPath(import.meta.url)); // backend/src/db
const PROJECT_ROOT = path.resolve(__dirname, '../../..'); // conflux-cas/

const rawDbPath = process.env.DATABASE_PATH ?? './data/cas.db';
const DB_PATH = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(PROJECT_ROOT, rawDbPath);

// Ensure data dir exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const sqlite: BetterSQLite3 = new Database(DB_PATH);
// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
