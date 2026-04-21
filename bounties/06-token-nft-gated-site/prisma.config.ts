import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI config (replaces deprecated package.json#prisma.seed).
 * With a config file present, Prisma does not auto-load .env — dotenv/config fixes that.
 * DATABASE_URL is still read from prisma/schema.prisma (Prisma 6).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
});
