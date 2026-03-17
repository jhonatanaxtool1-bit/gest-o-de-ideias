"""
Configuração centralizada via variáveis de ambiente.
Nenhum valor sensível hardcoded.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Suporte a execução local (fora do Docker) e a leitura opcional de `.env` montado no container.
# Não sobrescreve variáveis já definidas pelo ambiente/compose.
load_dotenv(override=False)

VARIAVEIS_OBRIGATORIAS = (
    "TELEGRAM_BOT_TOKEN",
    "OPENROUTER_API_KEY",
    "OBSIDIAN_API_BASE_URL",
)


def _obter_caminho_memoria() -> Path:
    """Caminho do memoria.json: env MEMORIA_PATH ou relativo ao pacote."""
    path_env = os.getenv("MEMORIA_PATH")
    if path_env:
        return Path(path_env)
    base = Path(__file__).resolve().parent
    return base / "memoria.json"


def validar_config() -> None:
    """Levanta ValueError listando variáveis de ambiente faltantes."""
    faltando = [v for v in VARIAVEIS_OBRIGATORIAS if not os.getenv(v)]
    if faltando:
        raise ValueError(
            f"Variáveis de ambiente obrigatórias não definidas: {', '.join(faltando)}. "
            "Use o arquivo .env ou exporte no ambiente."
        )
# Acesso às configurações (carregamento lazy para permitir testes)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OBSIDIAN_API_BASE_URL = os.getenv("OBSIDIAN_API_BASE_URL", "").rstrip("/")


def _normalizar_id(name: str) -> str:
    return (os.getenv(name, "") or "").replace("-", "").strip()


NOTION_PARENT_PAGE_ID = _normalizar_id("NOTION_PARENT_PAGE_ID")
NOTION_ROOT_PAGE_ID = _normalizar_id("NOTION_ROOT_PAGE_ID")

OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3-8b-instruct")
OPENROUTER_BASE_URL = os.getenv(
    "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1/chat/completions"
)
OPENROUTER_TIMEOUT = int(os.getenv("OPENROUTER_TIMEOUT", "60"))

MEMORIA_PATH = _obter_caminho_memoria()

# Opcional: chat_id do Telegram para envio automático de lembretes (job periódico).
# Se não definido, lembretes só são enviados quando o usuário pedir "me avise dos lembretes".
TELEGRAM_CHAT_ID = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()

# URL base do app (frontend) para o bot enviar links ao criar ideia/lista/tarefa/lembrete ou ao explicar suas funções.
# Ex.: https://meu-app.vercel.app ou http://localhost:5173
APP_BASE_URL = (os.getenv("APP_BASE_URL") or "").rstrip("/")

def _parse_allowed_users() -> list[str]:
    raw = os.getenv("ALLOWED_TELEGRAM_USERS", "")
    if not raw:
        return []
    return [u.strip().lstrip("@") for u in raw.split(",") if u.strip()]

ALLOWED_TELEGRAM_USERS = _parse_allowed_users()

# Chave de autenticação para a API do backend Obsidian_premium (header: Authorization: ApiKey <key>)
BOT_API_KEY = os.getenv("BOT_API_KEY", "").strip()
