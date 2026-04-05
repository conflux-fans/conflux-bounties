#!/usr/bin/env node
/**
 * One-shot caller for periodic token metadata refresh.
 * Schedule with cron, GitHub Actions, Kubernetes CronJob, or use docker-compose profile `cron`.
 *
 * Requires: CRON_SECRET, CRON_BASE_URL (or NEXT_PUBLIC_APP_URL), app reachable.
 */
import "dotenv/config";

const secret = process.env.CRON_SECRET?.trim();
const base = (
  process.env.CRON_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");

if (!secret || secret.length < 16) {
  console.error("metadata-cron: set CRON_SECRET (min 16 chars)");
  process.exit(1);
}

const url = `${base}/api/cron/metadata-refresh`;
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});

const text = await res.text();
console.log(text);
process.exit(res.ok ? 0 : 1);
