/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow server actions from both http and https localhost so `pnpm dev` and
    // `pnpm dev:https` both work without CSRF rejection.
    serverActions: {
      allowedOrigins: ['localhost:3000', 'https://localhost:3000'],
    },
  },
  // NOTE: /api/* proxying is handled by src/app/api/[...path]/route.ts
  // (App Router catch-all route handler) rather than rewrites, because
  // Next.js dev server doesn't reliably apply rewrites before routing /api/* paths.
};

module.exports = nextConfig;
