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

echo "Parando containers do compose..."
docker compose down --remove-orphans || true

# Forçar liberação das portas 4001 e 8813
echo "Verificando portas 4001 e 8813..."
for PORT in 4001 8813; do
  CONTAINERS=$(docker ps --format '{{.ID}} {{.Ports}}' \
    | grep ":${PORT}->" | awk '{print $1}')
  if [ -n "$CONTAINERS" ]; then
    echo "  Porta $PORT ocupada — removendo containers: $CONTAINERS"
    echo "$CONTAINERS" | xargs docker rm -f 2>/dev/null || true
  else
    echo "  Porta $PORT livre."
  fi
done

# Aguardar liberação das portas
echo "Aguardando portas liberarem..."
for PORT in 4001 8813; do
  TIMEOUT=15
  ELAPSED=0
  while ss -tlnp "sport = :${PORT}" 2>/dev/null | grep -q ":${PORT}"; do
    if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
      echo "ERRO: Porta $PORT ainda ocupada após ${TIMEOUT}s." >&2
      exit 1
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
  done
  echo "  Porta $PORT confirmada livre."
done

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
  docker compose up -d --remove-orphans
fi

echo "Deploy concluído!"
docker compose ps

