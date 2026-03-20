#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(root, "docker-compose.yml");

function printDockerMissing() {
  console.error("\n\x1b[33mDocker is not installed or not on your PATH.\x1b[0m\n");
  console.error("Pick one:\n");
  console.error(
    "  \x1b[1mA)\x1b[0m Install Docker Desktop, then run:  npm run db:up\n",
  );
  console.error("      https://docs.docker.com/get-docker/\n");
  console.error("  \x1b[1mB)\x1b[0m Use local PostgreSQL (macOS + Homebrew example):\n");
  console.error("      brew install postgresql@16");
  console.error("      brew services start postgresql@16");
  console.error("      createdb gated");
  console.error("      Set DATABASE_URL in .env (see README).\n");
  console.error(
    "  \x1b[1mC)\x1b[0m Use any hosted Postgres (Neon, Supabase, RDS) and set DATABASE_URL.\n",
  );
}

function printDaemonDown(stderr) {
  console.error("\n\x1b[33mDocker CLI works, but the Docker daemon is not running.\x1b[0m\n");

  if (process.platform === "darwin") {
    console.error("  \x1b[1mmacOS:\x1b[0m Open \x1b[1mDocker Desktop\x1b[0m from Applications.");
    console.error("  Wait until the menu bar whale is steady / “Docker Desktop is running”.\n");
    console.error("  Install: https://docs.docker.com/desktop/setup/install/mac-install/\n");
  } else {
    console.error("  Start Docker (e.g. \x1b[1msudo systemctl start docker\x1b[0m) or launch");
    console.error("  Colima / Rancher Desktop / OrbStack, then retry.\n");
  }

  if (stderr?.trim()) {
    console.error("\x1b[90m" + stderr.trim() + "\x1b[0m\n");
  }

  console.error(
    "\x1b[90mOr skip Docker: Homebrew Postgres or hosted DATABASE_URL — see README.\x1b[0m\n",
  );
}

function hasDockerComposeV2() {
  const r = spawnSync("docker", ["compose", "version"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  return r.status === 0;
}

function hasDockerComposeV1() {
  const r = spawnSync("docker-compose", ["version"], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (r.error?.code === "ENOENT") return false;
  return r.status === 0;
}

function printComposeHelp() {
  console.error(
    "\n\x1b[33mCould not run Docker Compose.\x1b[0m\n",
  );
  console.error("  \x1b[1mDocker Compose V2\x1b[0m (plugin): included with Docker Desktop.");
  console.error("  Check:  docker compose version\n");
  console.error("  \x1b[1mLegacy\x1b[0m binary:  brew install docker-compose");
  console.error("  Then:   docker-compose -f docker-compose.yml up --detach db\n");
}

const info = spawnSync("docker", ["info"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (info.error?.code === "ENOENT") {
  printDockerMissing();
  process.exit(127);
}

if (info.status !== 0) {
  printDaemonDown(info.stderr || info.stdout);
  process.exit(1);
}

const env = { ...process.env };
const opts = { stdio: "inherit", env, cwd: root };

/** Prefer V2 plugin; use long --detach (avoids rare CLI “-d” parse bugs). */
let result;
if (hasDockerComposeV2()) {
  result = spawnSync(
    "docker",
    ["compose", "-f", composeFile, "up", "--detach", "db"],
    opts,
  );
  if (result.status === 0) {
    process.exit(0);
  }
  if (hasDockerComposeV1()) {
    console.error(
      "\n\x1b[33m`docker compose up` failed; retrying with `docker-compose`…\x1b[0m\n",
    );
    result = spawnSync(
      "docker-compose",
      ["-f", composeFile, "up", "--detach", "db"],
      opts,
    );
  } else {
    printComposeHelp();
    process.exit(result.status === null ? 1 : result.status);
  }
} else if (hasDockerComposeV1()) {
  result = spawnSync(
    "docker-compose",
    ["-f", composeFile, "up", "--detach", "db"],
    opts,
  );
} else {
  printComposeHelp();
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    "\n\x1b[90mIf you saw “unknown shorthand flag: 'd'”, install Docker Desktop (Compose V2) or:\x1b[0m",
  );
  console.error(
    "\x1b[90m  brew install docker-compose && docker-compose -f docker-compose.yml up --detach db\x1b[0m\n",
  );
}

process.exit(result.status === null ? 1 : result.status);
