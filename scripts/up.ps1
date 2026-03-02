param(
  [switch]$NoCache,
  [switch]$NoAttach
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host "Repo root: $root"

if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
  throw "docker-compose.yml não encontrado em $root"
}

Write-Host "Checando status do git..."
$gitStatus = git -C $root status --porcelain
if ($gitStatus) {
  Write-Host $gitStatus
  throw "Há alterações locais não commitadas. Commit/push antes de buildar no servidor, ou rode localmente sabendo que o servidor não verá essas mudanças."
}

$frontend = Join-Path $root "Obsidian_premium\frontend"
if (-not (Test-Path $frontend)) {
  throw "Pasta do frontend não encontrada: $frontend"
}

Write-Host "Buildando frontend (npm ci + npm run build)..."
Push-Location $frontend
try {
  npm ci
  npm run build
} finally {
  Pop-Location
}

Write-Host "Subindo containers..."
Push-Location $root
try {
  if ($NoCache) {
    docker compose build --no-cache
  } else {
    docker compose build
  }

  if ($NoAttach) { docker compose up } else { docker compose up -d }
} finally {
  Pop-Location
}

