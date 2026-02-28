#!/bin/bash
# Setup da VPS Ubuntu para deploy automático (Docker + GitHub Actions).
# Uso: sudo ./setup-vps-ubuntu.sh
#      GITHUB_REPO='https://github.com/USER/REPO.git' sudo ./setup-vps-ubuntu.sh  # para clonar na hora

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[AVISO]${NC} $1"; }
err()   { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

[ -n "$SUDO_UID" ] || [ "$(id -u)" -eq 0 ] || err "Execute com sudo: sudo $0"

# --- Configuração (ajuste se quiser) ---
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_HOME="/home/$DEPLOY_USER"
DEPLOY_DIR="${DEPLOY_DIR:-$DEPLOY_HOME/gestao-ideias}"
GITHUB_REPO="${GITHUB_REPO:-}"   # ex: https://github.com/SEU_USER/gestao-ideias.git

# --- 1. Instalar dependências ---
info "Atualizando pacotes..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git

# --- 2. Instalar Docker (repositório oficial) ---
if command -v docker &>/dev/null; then
    info "Docker já instalado: $(docker --version)"
else
    info "Instalando Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-$VERSION_ID}") stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    info "Docker instalado: $(docker --version)"
fi

# --- 3. Criar usuário deploy (se não existir) ---
if id "$DEPLOY_USER" &>/dev/null; then
    info "Usuário $DEPLOY_USER já existe."
else
    info "Criando usuário $DEPLOY_USER..."
    useradd -m -s /bin/bash "$DEPLOY_USER"
    usermod -aG docker "$DEPLOY_USER"
    info "Usuário $DEPLOY_USER criado e adicionado ao grupo docker."
fi

# Garantir que está no grupo docker
if ! groups "$DEPLOY_USER" | grep -q docker; then
    usermod -aG docker "$DEPLOY_USER"
    info "$DEPLOY_USER adicionado ao grupo docker."
fi

# --- 4. SSH para deploy (GitHub Actions vai usar essa chave) ---
SSH_DIR="$DEPLOY_HOME/.ssh"
mkdir -p "$SSH_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [ ! -f "$SSH_DIR/authorized_keys" ]; then
    touch "$SSH_DIR/authorized_keys"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR/authorized_keys"
    chmod 600 "$SSH_DIR/authorized_keys"
fi

# Se existir chave pública no diretório atual, adicionar (opcional)
if [ -f "deploy_key.pub" ]; then
    cat deploy_key.pub >> "$SSH_DIR/authorized_keys"
    info "Chave deploy_key.pub adicionada a authorized_keys."
fi

# --- 5. Clonar repositório (se GITHUB_REPO foi definido) ---
BOT_ENV_PATH="$DEPLOY_DIR/bot - secretaria da minha vida/.env"
if [ -n "$GITHUB_REPO" ]; then
    if [ -d "$DEPLOY_DIR" ]; then
        info "Diretório $DEPLOY_DIR já existe. Pulando clone."
    else
        info "Clonando repositório em $DEPLOY_DIR..."
        sudo -u "$DEPLOY_USER" git clone "$GITHUB_REPO" "$DEPLOY_DIR"
        info "Repositório clonado."
    fi
else
    if [ ! -d "$DEPLOY_DIR" ]; then
        mkdir -p "$DEPLOY_DIR"
        chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR"
        warn "Diretório $DEPLOY_DIR criado vazio. Clone o repositório manualmente:"
        echo "  sudo -u $DEPLOY_USER git clone https://github.com/SEU_USER/SEU_REPO.git $DEPLOY_DIR"
    fi
fi

# --- 6. Arquivo .env do bot (template se não existir) ---
BOT_DIR="$DEPLOY_DIR/bot - secretaria da minha vida"
if [ -d "$BOT_DIR" ] && [ ! -f "$BOT_ENV_PATH" ]; then
    if [ -f "$BOT_DIR/.env.example" ]; then
        sudo -u "$DEPLOY_USER" cp "$BOT_DIR/.env.example" "$BOT_DIR/.env"
        info "Criado $BOT_DIR/.env a partir de .env.example. Edite e preencha os tokens."
    else
        sudo -u "$DEPLOY_USER" touch "$BOT_DIR/.env"
        info "Criado $BOT_DIR/.env vazio. Adicione TELEGRAM_BOT_TOKEN, OPENROUTER_API_KEY, etc."
    fi
fi

# --- 7. Instruções finais ---
echo ""
echo -e "${GREEN}=== Setup concluído ===${NC}"
echo ""
echo "1) Gere uma chave SSH para o GitHub Actions (no seu PC ou na VPS):"
echo "   ssh-keygen -t ed25519 -C deploy -f deploy_key -N \"\""
echo "   Adicione deploy_key.pub em $SSH_DIR/authorized_keys do usuário $DEPLOY_USER."
echo "   No GitHub (Settings → Secrets): use o conteúdo de deploy_key como VPS_SSH_KEY."
echo ""
echo "2) No GitHub, crie os secrets:"
echo "   VPS_HOST     = IP ou domínio desta VPS"
echo "   VPS_USER     = $DEPLOY_USER"
echo "   VPS_SSH_KEY  = conteúdo do arquivo deploy_key (chave privada)"
echo "   DEPLOY_PATH  = $DEPLOY_DIR"
echo ""
echo "3) Se ainda não clonou o repositório:"
echo "   sudo -u $DEPLOY_USER git clone <URL_DO_SEU_REPO> $DEPLOY_DIR"
echo ""
echo "4) Edite o .env do bot e suba os containers:"
echo "   sudo -u $DEPLOY_USER bash -c 'cd $DEPLOY_DIR && docker compose up -d --build'"
echo ""
