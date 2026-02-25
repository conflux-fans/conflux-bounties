Build & Deploy — Docker Compose

This repository supports containerized deployment via Docker Compose. Use multi-arch builds when deploying to ARM64 hosts (Hetzner CAX11).

1) Build and push multi-arch images (example uses GitHub Container Registry):

```bash
# Build & push frontend
docker buildx build --platform linux/amd64,linux/arm64 \
  --file conflux-cas/frontend/Dockerfile \
  --tag ghcr.io/<org>/cas-frontend:latest --push conflux-cas

# Build & push backend
docker buildx build --platform linux/amd64,linux/arm64 \
  --file conflux-cas/backend/Dockerfile \
  --tag ghcr.io/<org>/cas-backend:latest --push conflux-cas

# Build & push worker
docker buildx build --platform linux/amd64,linux/arm64 \
  --file conflux-cas/worker/Dockerfile \
  --tag ghcr.io/<org>/cas-worker:latest --push conflux-cas
```

2) On the target host, prepare environment and pull the images:

```bash
# copy example env and edit secrets
cp conflux-cas/.env.example /path/to/deploy/.env
# populate JWT_SECRET, EXECUTOR_PRIVATE_KEY, AUTOMATION_MANAGER_ADDRESS, etc.

cd /path/to/deploy/conflux-cas
docker compose pull && docker compose up -d --force-recreate
```

3) Verify services and logs:

```bash
docker compose ps
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f worker
```

Notes:
- Use `docker buildx` for cross-platform builds when deploying to ARM64 or mixed environments.
- Protect secrets: prefer Docker secrets or an external secret manager for `EXECUTOR_PRIVATE_KEY` and `JWT_SECRET` in production.
- When updating images you can automate a `docker compose pull && docker compose up -d --force-recreate` in CI.

---

## Build & Update All Services (align deployed stack with latest changes)

When the system is already deployed and you need to align it with local changes (code, configs, or bug fixes), follow these steps.

1) Prepare build environment

```bash
# From your workspace root
git fetch --all && git checkout <branch> && git pull --ff-only
pnpm install --frozen-lockfile

# (optional) run tests and typecheck before building
pnpm -w test
pnpm -w type-check
```

2) Generate artifacts (if applicable)

```bash
# Regenerate contract codegen (if contracts changed)
pnpm contracts:codegen

# Any other codegen or build steps (e.g. SDK compilation)
pnpm --filter @cfxdevkit/sdk build
```

3) Build multi-arch Docker images and push with an immutable tag (recommended)

```bash
# Use a reproducible tag like the short git SHA
TAG=$(git rev-parse --short HEAD)

# Frontend
docker buildx build --platform linux/amd64,linux/arm64 \
  --file conflux-cas/frontend/Dockerfile \
  --tag ghcr.io/<org>/cas-frontend:${TAG} \
  --tag ghcr.io/<org>/cas-frontend:latest \
  --push conflux-cas

# Backend
docker buildx build --platform linux/amd64,linux/arm64 \
  --file conflux-cas/backend/Dockerfile \
  --tag ghcr.io/<org>/cas-backend:${TAG} \
  --tag ghcr.io/<org>/cas-backend:latest \
  --push conflux-cas

# Worker
docker buildx build --platform linux/amd64,linux/arm64 \
  --file conflux-cas/worker/Dockerfile \
  --tag ghcr.io/<org>/cas-worker:${TAG} \
  --tag ghcr.io/<org>/cas-worker:latest \
  --push conflux-cas
```

Notes:
- Tagging with `${TAG}` lets you roll back by redeploying an older tag.
- Pushing `:latest` is convenient but avoid relying on it for rollbacks; prefer explicit tags.

4) Deploy updated images on the host

```bash
# On the server
cd /path/to/deploy/conflux-cas

# Optional: backup DB before changes
cp data/cas.db data/cas.db.bak.$(date +%Y%m%d_%H%M%S)

# Pull new images and recreate services (pick all or a subset).
# Example: pull and recreate worker only
docker compose pull && docker compose up -d --force-recreate worker

# Full stack: pull and recreate all services
docker compose pull && docker compose up -d --force-recreate
```

5) Run DB migrations (if your change added migration scripts)

If your backend uses a migration tool, run migrations before restarting services that depend on the newer schema. Example (replace with your project's migration command):

```bash
# Example placeholder — adapt to your migration tool
cd conflux-cas/backend
pnpm run migrate
```

6) Invalidate caches and refresh pool metadata

```bash
# Refresh backend pool cache so frontend picks up new pairs/decimals
curl -X POST -sS http://localhost:3001/api/pools/refresh
```

7) Smoke tests & verification

```bash
# Check service status and logs
docker compose ps
docker compose logs -f --tail=200 frontend backend worker

# Simple HTTP checks
curl -sS -I http://localhost:3000/ | head
curl -sS http://localhost:3001/api/status

# Verify worker log shows expected behavior (price checks, executions)
docker compose logs worker --since 1m | tail -n 200
```

8) Rollback (if needed)

```bash
# Redeploy an earlier tag
docker compose pull
docker compose up -d --force-recreate
# or alter docker-compose.yml to pin an older image tag and `docker compose up -d`
```

Tips & reminders

- Use immutable tags (commit SHA) in CI to simplify rollbacks.
- Keep secrets out of the repo; use Docker secrets or environment management on the host.
- For small code-only changes to the worker, you can rebuild/push only the worker image and recreate just that service to minimize downtime.
- If you changed contract ABIs/addresses, run `pnpm contracts:codegen` and rebuild SDK/backend before building images.

