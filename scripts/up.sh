#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if [ ! -f "$ROOT_DIR/docker-compose.yml" ]; then
  echo "docker-compose.yml não encontrado em $ROOT_DIR" >&2
  exit 1
fi

echo "Repo root: $ROOT_DIR"

echo "Checando status do git..."
if git -C "$ROOT_DIR" status --porcelain | grep -q .; then
  git -C "$ROOT_DIR" status --porcelain
  echo "Há alterações locais não commitadas. Commit/push antes de buildar no servidor, ou rode localmente sabendo que o servidor não verá essas mudanças." >&2
  exit 1
fi

FRONTEND_DIR="$ROOT_DIR/Obsidian_premium/frontend"
if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Pasta do frontend não encontrada: $FRONTEND_DIR" >&2
  exit 1
fi

echo "Buildando frontend (npm ci + npm run build)..."
(
  cd "$FRONTEND_DIR"
  npm ci
  npm run build
)

echo "Subindo containers..."
cd "$ROOT_DIR"

NO_CACHE="${NO_CACHE:-0}"
NO_DETACH="${NO_DETACH:-0}"

if [ "$NO_CACHE" = "1" ]; then
  docker compose build --no-cache
else
  docker compose build
fi

if [ "$NO_DETACH" = "1" ]; then
  docker compose up
else
  docker compose up -d
fi

