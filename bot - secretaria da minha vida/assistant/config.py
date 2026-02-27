"""
Configuração centralizada via variáveis de ambiente.
Nenhum valor sensível hardcoded.
"""
import os
from pathlib import Path

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
