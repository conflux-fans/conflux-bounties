// Drizzle client for Supabase - much lighter than Prisma!
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Create connection to Supabase
const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it's not supported by the Supabase-managed proxy
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export type DrizzleDB = typeof db;

// Alternative for Edge Runtime (if needed)
export const createDbConnection = (connectionString: string) => {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
};
