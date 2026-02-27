"""Cliente REST simples para o backend Obsidian_premium.
Fornece funções para listar/criar interesses, áreas, documentos e cards de planejamento.
"""
from __future__ import annotations

import logging
import requests
import uuid
from typing import List, Optional
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

