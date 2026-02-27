"""
Memória local persistente em JSON.
Funções para carregar, salvar e atualizar; caminho centralizado em config.
"""
import json
import logging
from copy import deepcopy
from pathlib import Path

from assistant.config import MEMORIA_PATH

logger = logging.getLogger(__name__)

ESTRUTURA_PADRAO = {
    "usuario": {
        "perfil": "programador",
        "interesses": ["python", "diversas linguagens", "tecnologia"],
    }
}


def carregar_memoria() -> dict:
    """
    Carrega o conteúdo de memoria.json.
    Se o arquivo não existir ou for inválido, retorna estrutura padrão e salva.
    """
    path = Path(MEMORIA_PATH)
    if not path.exists():
        logger.warning("memoria.json não encontrado; usando estrutura padrão")
        salvar_memoria(ESTRUTURA_PADRAO)
        return deepcopy(ESTRUTURA_PADRAO)
    try:
        with open(path, "r", encoding="utf-8") as f:
            dados = json.load(f)
        return dados
    except json.JSONDecodeError as e:
        logger.error("memoria.json inválido: %s", e)
        salvar_memoria(ESTRUTURA_PADRAO)
        return deepcopy(ESTRUTURA_PADRAO)
    except OSError as e:
        logger.error("Erro ao ler memoria.json: %s", e)
        raise


def salvar_memoria(dados: dict) -> None:
    """Persiste o dict no arquivo com indentação."""
    path = Path(MEMORIA_PATH)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
    except OSError as e:
        logger.error("Erro ao salvar memoria.json: %s", e)
        raise


def _merge_profundo(base: dict, atualizacoes: dict) -> dict:
    """Faz merge recursivo de atualizacoes em base (in-place em cópia de base)."""
    resultado = deepcopy(base)
    for chave, valor in atualizacoes.items():
        if chave in resultado and isinstance(resultado[chave], dict) and isinstance(valor, dict):
            resultado[chave] = _merge_profundo(resultado[chave], valor)
        else:
            resultado[chave] = deepcopy(valor)
    return resultado


def atualizar_memoria(atualizacoes: dict) -> dict:
    """
    Mescla atualizacoes na memória atual, salva e retorna o estado atual.
    Merge é profundo para dicts aninhados.
    """
    atual = carregar_memoria()
    novo = _merge_profundo(atual, atualizacoes)
    salvar_memoria(novo)
    return novo


def set_pending_action(action: dict) -> dict:
    """Armazena uma pending_action na memória."""
    atual = carregar_memoria()
    atual['pending_action'] = action
    salvar_memoria(atual)
    return atual


def get_pending_action() -> dict | None:
    atual = carregar_memoria()
    return atual.get('pending_action')


def clear_pending_action() -> dict:
    atual = carregar_memoria()
    if 'pending_action' in atual:
        del atual['pending_action']
        salvar_memoria(atual)
    return atual
