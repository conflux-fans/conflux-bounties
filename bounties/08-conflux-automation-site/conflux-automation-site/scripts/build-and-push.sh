#!/usr/bin/env bash
# Build multi-arch Docker images (linux/amd64 + linux/arm64) and push to ghcr.io.
#
# Prerequisites:
#   docker buildx (Docker 20+)
#   GITHUB_TOKEN env var with write:packages scope
#   OR: run `docker login ghcr.io -u <github-username>` first
#
# Usage:
#   cd /path/to/repos/conflux-cas
#   GITHUB_TOKEN=<token> ../scripts/build-and-push.sh
#   # or with a specific tag:
#   TAG=v1.2.0 ../scripts/build-and-push.sh

set -euo pipefail

REGISTRY="ghcr.io/cfxdevkit"
TAG="${TAG:-latest}"
PLATFORMS="linux/amd64,linux/arm64"
BUILDER_NAME="cas-multiarch"

# Build context is the workspace root (repos/) which contains both
# conflux-cas/ and conflux-sdk/ — required by the Dockerfiles.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTEXT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKERFILE_DIR="${CONTEXT_DIR}/conflux-cas"

echo "==> Build context : ${CONTEXT_DIR}"
echo "==> Registry      : ${REGISTRY}"
echo "==> Tag           : ${TAG}"
echo "==> Platforms     : ${PLATFORMS}"
echo ""

# ── Authenticate ──────────────────────────────────────────────────────────────
# GITHUB_TOKEN must have write:packages scope.
# GITHUB_USER defaults to the git user.name (must match your GitHub username).
GITHUB_USER="${GITHUB_USER:-$(git config user.name)}"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  echo "${GITHUB_TOKEN}" | docker login ghcr.io -u "${GITHUB_USER}" --password-stdin
else
  echo "WARN: GITHUB_TOKEN not set — assuming already logged in to ghcr.io"
fi

# ── Set up multi-arch builder ─────────────────────────────────────────────────
# docker-container driver supports cross-platform via QEMU.
if ! docker buildx inspect "${BUILDER_NAME}" &>/dev/null; then
  echo "==> Creating buildx builder '${BUILDER_NAME}'..."
  docker buildx create \
    --name "${BUILDER_NAME}" \
    --driver docker-container \
    --driver-opt network=host \
    --platform "${PLATFORMS}" \
    --bootstrap
else
  echo "==> Using existing builder '${BUILDER_NAME}'"
fi

docker buildx use "${BUILDER_NAME}"

# ── Build + push ──────────────────────────────────────────────────────────────
build_image() {
  local service="$1"
  local dockerfile="${DOCKERFILE_DIR}/${service}/Dockerfile"
  local image="${REGISTRY}/cas-${service}:${TAG}"

  echo ""
  echo "==> Building ${image} ..."
  docker buildx build \
    --platform "${PLATFORMS}" \
    --file "${dockerfile}" \
    --tag "${image}" \
    --push \
    "${CONTEXT_DIR}"

  # Also tag as :latest if a version tag was given
  if [[ "${TAG}" != "latest" ]]; then
    docker buildx build \
      --platform "${PLATFORMS}" \
      --file "${dockerfile}" \
      --tag "${REGISTRY}/cas-${service}:latest" \
      --push \
      "${CONTEXT_DIR}"
  fi

  echo "==> Pushed ${image}"
}

build_image backend
build_image worker
build_image frontend

echo ""
echo "✓ All images pushed to ${REGISTRY}"
echo ""
echo "On the server run:"
echo "  cd ~/repos/conflux-cas"
echo "  docker compose -f docker-compose.prod.yml pull"
echo "  docker compose -f docker-compose.prod.yml up -d"
