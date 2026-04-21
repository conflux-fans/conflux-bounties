/** Shared env for unit tests (getEnv / Prisma clients that read process.env). */
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://test:test@127.0.0.1:5432/test?schema=public";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "test-session-secret-32-characters-min";
process.env.SIWC_DOMAIN = process.env.SIWC_DOMAIN || "localhost";
process.env.STORAGE_MODE = process.env.STORAGE_MODE || "local";
