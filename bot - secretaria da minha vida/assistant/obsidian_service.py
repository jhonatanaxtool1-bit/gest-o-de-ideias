"""Cliente REST simples para o backend Obsidian_premium.
Fornece funções para listar/criar/atualizar interesses, áreas, documentos, listas e cards de planejamento.
"""
from __future__ import annotations

import logging
import requests
import uuid
from typing import Any, List, Optional
from datetime import datetime

from assistant.config import OBSIDIAN_API_BASE_URL, OPENROUTER_TIMEOUT

logger = logging.getLogger(__name__)


def _base(path: str) -> str:
    return f"{OBSIDIAN_API_BASE_URL.rstrip('/')}{path}"


def listar_interesses() -> List[dict]:
    resp = requests.get(_base("/api/interests"), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def listar_areas() -> List[dict]:
    resp = requests.get(_base("/api/areas"), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_interesse(name: str) -> dict:
    payload = {"id": str(uuid.uuid4()), "name": name, "createdAt": datetime.utcnow().isoformat()}
    resp = requests.post(_base("/api/interests"), json=payload, timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_area(name: str, interest_id: str) -> dict:
    payload = {"id": str(uuid.uuid4()), "name": name, "interestId": interest_id, "createdAt": datetime.utcnow().isoformat()}
    resp = requests.post(_base("/api/areas"), json=payload, timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def listar_documentos() -> List[dict]:
    resp = requests.get(_base("/api/documents"), timeout=OPENROUTER_TIMEOUT)
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
    resp = requests.post(_base("/api/documents"), json=payload, timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def atualizar_documento(doc_id: str, payload: dict) -> dict:
    """Atualiza um documento (ideia) existente. payload pode conter title, content, interest, area, tags, etc."""
    resp = requests.patch(_base(f"/api/documents/{doc_id}"), json=payload, timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def listar_listas() -> List[dict]:
    resp = requests.get(_base("/api/lists"), timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def criar_lista(
    title: str,
    list_type: str = "geral",
    items: Optional[List[dict]] = None,
) -> dict:
    now = datetime.utcnow().isoformat()
    list_id = str(uuid.uuid4())
    item_list = []
    for i, it in enumerate(items or []):
        label = (it.get("label") or it.get("titulo") or "").strip() or "(item)"
        item_list.append({
            "id": str(uuid.uuid4()),
            "label": label,
            "order": i,
            "done": bool(it.get("done", False)),
            "createdAt": now,
        })
    payload = {
        "id": list_id,
        "title": title or "Sem título",
        "listType": list_type or "geral",
        "createdAt": now,
        "updatedAt": now,
        "items": item_list,
    }
    resp = requests.post(_base("/api/lists"), json=payload, timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def atualizar_lista(list_id: str, payload: dict) -> dict:
    """Atualiza título/tipo da lista ou substitui itens. payload: title?, listType?, items? (array completo)."""
    resp = requests.patch(_base(f"/api/lists/{list_id}"), json=payload, timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def adicionar_item_lista(list_id: str, label: str, order: Optional[int] = None) -> dict:
    if order is None:
        listas = listar_listas()
        lst = next((l for l in listas if l.get("id") == list_id), None)
        order = len(lst.get("items", [])) if lst else 0
    now = datetime.utcnow().isoformat()
    payload = {
        "id": str(uuid.uuid4()),
        "label": label or "",
        "order": order,
        "done": False,
        "createdAt": now,
    }
    resp = requests.post(_base(f"/api/lists/{list_id}/items"), json=payload, timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def atualizar_item_lista(list_id: str, item_id: str, label: Optional[str] = None, done: Optional[bool] = None) -> dict:
    payload: dict[str, Any] = {}
    if label is not None:
        payload["label"] = label
    if done is not None:
        payload["done"] = done
    if not payload:
        return {}
    resp = requests.patch(_base(f"/api/lists/{list_id}/items/{item_id}"), json=payload, timeout=OPENROUTER_TIMEOUT)
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
    resp = requests.post(_base("/api/professional-planning/cards"), json=payload, timeout=OPENROUTER_TIMEOUT)
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
    resp = requests.post(_base("/api/personal-planning/cards"), json=payload, timeout=OPENROUTER_TIMEOUT)
    resp.raise_for_status()
    return resp.json()

