"""Cliente REST simples para o backend Obsidian_premium.
Fornece funções para listar/criar/atualizar interesses, áreas, documentos, listas e cards de planejamento.
"""
from __future__ import annotations

import logging
import requests
import uuid
from typing import Any, List, Optional
from datetime import datetime

from assistant.config import OBSIDIAN_API_BASE_URL, OPENROUTER_TIMEOUT, BOT_API_KEY

logger = logging.getLogger(__name__)


def _base(path: str) -> str:
    return f"{OBSIDIAN_API_BASE_URL.rstrip('/')}{path}"


def _auth_headers() -> dict:
    if BOT_API_KEY:
        return {"Authorization": f"ApiKey {BOT_API_KEY}"}
    return {}


def listar_interesses() -> List[dict]:
    resp = requests.get(_base("/api/interests"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def listar_areas() -> List[dict]:
    resp = requests.get(_base("/api/areas"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_interesse(name: str) -> dict:
    payload = {"id": str(uuid.uuid4()), "name": name, "createdAt": datetime.utcnow().isoformat()}
    resp = requests.post(_base("/api/interests"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_area(name: str, interest_id: str) -> dict:
    payload = {"id": str(uuid.uuid4()), "name": name, "interestId": interest_id, "createdAt": datetime.utcnow().isoformat()}
    resp = requests.post(_base("/api/areas"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def listar_documentos() -> List[dict]:
    resp = requests.get(_base("/api/documents"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_documento(title: str, content: str, interest: str = "", area: str = "", tags: Optional[List[str]] = None) -> dict:
    payload = {
        "id": str(uuid.uuid4()),
        "title": title or "Sem título",
        "cover": "",
        "content": content or "",
        "interest": interest or "",
        "area": area or "",
        "tags": tags or [],
        "relations": [],
        "createdAt": datetime.utcnow().isoformat(),
    }
    resp = requests.post(_base("/api/documents"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def atualizar_documento(doc_id: str, payload: dict) -> dict:
    """Atualiza um documento (ideia) existente. payload pode conter title, content, interest, area, tags, etc."""
    resp = requests.patch(_base(f"/api/documents/{doc_id}"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_card_planejamento(title: str, status: str = "todo", priority: str = "medium") -> dict:
    payload = {
        "id": str(uuid.uuid4()),
        "title": title,
        "status": status,
        "priority": priority,
        "isFinalized": False,
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }
    resp = requests.post(_base("/api/professional-planning/cards"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def atualizar_card_planejamento(card_id: str, payload: dict) -> dict:
    """Atualiza um card do planejamento profissional. payload: title?, status?, priority?, isFinalized?."""
    resp = requests.patch(_base(f"/api/professional-planning/cards/{card_id}"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_card_planejamento_pessoal(title: str, status: str = "todo", priority: str = "medium") -> dict:
    payload = {
        "id": str(uuid.uuid4()),
        "title": title,
        "status": status,
        "priority": priority,
        "isFinalized": False,
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }
    resp = requests.post(_base("/api/personal-planning/cards"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def atualizar_card_planejamento_pessoal(card_id: str, payload: dict) -> dict:
    """Atualiza um card do planejamento pessoal. payload: title?, status?, priority?, isFinalized?."""
    resp = requests.patch(_base(f"/api/personal-planning/cards/{card_id}"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def listar_cards_planejamento() -> List[dict]:
    resp = requests.get(_base("/api/professional-planning/cards"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def listar_cards_planejamento_pessoal() -> List[dict]:
    resp = requests.get(_base("/api/personal-planning/cards"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


# --- Lembretes ---

def listar_lembretes() -> List[dict]:
    resp = requests.get(_base("/api/reminders"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def listar_lembretes_vencidos() -> List[dict]:
    """Retorna lembretes que estão vencidos (devem ser disparados agora)."""
    resp = requests.get(_base("/api/reminders/due"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_lembrete(
    title: str,
    first_due_at: str,
    body: str = "",
    recurrence: str = "once",
) -> dict:
    payload = {
        "id": str(uuid.uuid4()),
        "title": title.strip(),
        "body": (body or "").strip(),
        "firstDueAt": first_due_at,
        "recurrence": recurrence if recurrence in ("once", "daily", "every_2_days", "weekly") else "once",
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }
    resp = requests.post(_base("/api/reminders"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def marcar_lembrete_disparado(reminder_id: str) -> dict:
    """Atualiza lastTriggeredAt para que o lembrete não seja reenviado até a próxima recorrência."""
    now = datetime.utcnow().isoformat()
    resp = requests.patch(
        _base(f"/api/reminders/{reminder_id}"),
        json={"lastTriggeredAt": now},
        headers=_auth_headers(),
        timeout=OPENROUTER_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def atualizar_lembrete(reminder_id: str, payload: dict) -> dict:
    """Atualiza um lembrete (título, corpo, data, recorrência, etc.)."""
    resp = requests.patch(_base(f"/api/reminders/{reminder_id}"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


# --- Operações de exclusão ---

def deletar_documento(doc_id: str) -> None:
    """Remove permanentemente uma ideia/documento."""
    resp = requests.delete(_base(f"/api/documents/{doc_id}"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()


def deletar_card_planejamento(card_id: str) -> None:
    """Remove permanentemente um card do planejamento empresarial."""
    resp = requests.delete(_base(f"/api/professional-planning/cards/{card_id}"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()


def deletar_card_planejamento_pessoal(card_id: str) -> None:
    """Remove permanentemente um card do planejamento pessoal."""
    resp = requests.delete(_base(f"/api/personal-planning/cards/{card_id}"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()


def deletar_lembrete(reminder_id: str) -> None:
    """Remove permanentemente um lembrete."""
    resp = requests.delete(_base(f"/api/reminders/{reminder_id}"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()


# --- Tarefas Diárias ---

def listar_tarefas_diarias() -> List[dict]:
    """Lista as tarefas diárias de hoje."""
    resp = requests.get(_base("/api/daily-tasks"), headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_tarefa_diaria(title: str) -> dict:
    """Cria uma nova tarefa diária."""
    payload = {
        "id": str(uuid.uuid4()),
        "title": title,
        "done": False,
        "createdAt": datetime.utcnow().isoformat(),
    }
    resp = requests.post(_base("/api/daily-tasks"), json=payload, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def atualizar_tarefa_diaria(task_id: str, done: bool) -> dict:
    """Marca uma tarefa diária como concluída ou pendente."""
    resp = requests.patch(_base(f"/api/daily-tasks/{task_id}"), json={"done": done}, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


# --- Busca ---

def buscar_documentos(termo: str = "", interest: str = "", area: str = "", tag: str = "") -> List[dict]:
    """Busca documentos no servidor com filtros opcionais."""
    params: dict = {}
    if termo:
        params["q"] = termo
    if interest:
        params["interest"] = interest
    if area:
        params["area"] = area
    if tag:
        params["tag"] = tag
    resp = requests.get(_base("/api/documents/search"), params=params, headers=_auth_headers(), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()

