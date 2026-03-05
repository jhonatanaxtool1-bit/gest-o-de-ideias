"""Bot Telegram: recebe texto e áudio, estrutura via LLM e salva como notas no Obsidian_premium.
Ponto de entrada: na raiz do projeto, execute: python -m assistant.bot
Requer .env com TELEGRAM_BOT_TOKEN, OPENROUTER_API_KEY e OBSIDIAN_API_BASE_URL.
"""
# Carregar .env da raiz do projeto antes de qualquer import que use config
try:
    from dotenv import load_dotenv
    import os as _os
    _raiz = _os.path.normpath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".."))
    load_dotenv(_os.path.join(_raiz, ".env"))
except ImportError:
    pass

import logging
import os
import tempfile
from pathlib import Path

from telegram import Update
from telegram.ext import Application, ContextTypes, MessageHandler, filters

import requests

from assistant import audio, config, llm, memory, obsidian_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
# Silenciar bibliotecas externas barulhentas
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("selenium").setLevel(logging.WARNING)
logging.getLogger("telegram").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

RESPOSTA_ERRO = "Não foi possível processar agora. Tente mais tarde."


def _link(path: str) -> str:
    """Retorna URL completa do app para o path (ex.: ideia/123, listas). Se APP_BASE_URL não estiver definido, retorna vazio."""
    base = getattr(config, "APP_BASE_URL", "") or ""
    if not base:
        return ""
    return f"{base}/{path.lstrip('/')}"


# Palavras que indicam pedido de salvar/guardar ideia (para buscar interesses e áreas)
_PALAVRAS_SALVAR_IDEIA = ("guardar", "salvar", "anotar", "ideia", "nota", "registrar", "gravar")


def _parece_pedido_salvar_ideia(texto: str) -> bool:
    """True se a mensagem parece pedir para salvar/guardar uma ideia."""
    t = texto.lower().strip()
    return any(p in t for p in _PALAVRAS_SALVAR_IDEIA)


def _parece_pergunta_funcao(texto: str) -> bool:
    """True se a mensagem parece perguntar sobre as funções/capacidades do bot."""
    t = texto.lower().strip()
    return any(
        k in t
        for k in (
            "função",
            "funções",
            "funcoes",
            "o que você faz",
            "o que voce faz",
            "o que faz",
            "quais são suas funções",
            "quais sao suas funcoes",
            "quais suas funções",
            "capacidades",
            "o que você pode",
            "o que voce pode",
        )
    )


def _parece_pergunta_interesses_areas(texto: str) -> bool:
    """True se a mensagem parece pedir a lista de interesses/áreas (categorias)."""
    t = texto.lower().strip()
    if any(k in t for k in ("categoria", "categorias", "categ")):
        return True
    tem_interesse = any(k in t for k in ("interesse", "interesses", "interres", "interreses", "interes"))
    tem_area = any(k in t for k in ("área", "area", "áreas", "areas"))
    return tem_interesse and tem_area


def _formatar_lista_interesses_areas(interesses: list[dict], areas: list[dict]) -> str:
    """Formata em lista numerada hierárquica: 1 – Interesse, 1.1 – Área, 1.2 – Área, 2 – Interesse..."""
    areas_by_interest_id: dict[str, list[str]] = {}
    for a in (areas or []):
        interest_id = a.get("interestId")
        name = (a.get("name") or "").strip()
        if not interest_id or not name:
            continue
        areas_by_interest_id.setdefault(interest_id, []).append(name)

    interesses_ordenados = sorted(
        (interesses or []), key=lambda it: ((it.get("name") or "").strip().lower())
    )
    if not interesses_ordenados:
        return "Suas categorias são:\n\n(sem interesses/áreas cadastrados)"

    linhas: list[str] = ["Suas categorias são:\n"]
    for idx, i in enumerate(interesses_ordenados, start=1):
        interest_name = (i.get("name") or "").strip()
        if not interest_name:
            continue
        a_names = sorted(set(areas_by_interest_id.get(i.get("id"), [])), key=lambda s: s.lower())
        linhas.append(f"{idx} – {interest_name}")
        for sub_idx, area_name in enumerate(a_names, start=1):
            linhas.append(f"{idx}.{sub_idx} – {area_name}")
        linhas.append("")  # linha em branco entre interesses

    return "\n".join(linhas).rstrip()


def _normalize(s: str) -> str:
    """Normaliza para comparação: strip e colapsa espaços múltiplos."""
    return " ".join((s or "").strip().lower().split())


def _match_interest_intelligent(user_input: str, interests: list[dict]) -> dict | None:
    """
    Busca inteligente: exato > nome começa com o que o usuário disse > nome contém.
    Usa normalização (espaços colapsados) para evitar falhas por diferença de espaços.
    """
    if not (user_input and user_input.strip()) or not interests:
        return None
    key = _normalize(user_input)
    exact = next((i for i in interests if _normalize(i.get("name") or "") == key), None)
    if exact:
        return exact
    starts = next(
        (i for i in interests if _normalize(i.get("name") or "").startswith(key)),
        None,
    )
    if starts:
        return starts
    containing = [i for i in interests if key in _normalize(i.get("name") or "")]
    if containing:
        return min(containing, key=lambda i: len((i.get("name") or "")))
    return None


def _match_area_intelligent(user_input: str, areas: list[dict]) -> dict | None:
    """Busca inteligente para área (exato > começa com > contém), com normalização."""
    if not (user_input and user_input.strip()) or not areas:
        return None
    key = _normalize(user_input)
    exact = next((a for a in areas if _normalize(a.get("name") or "") == key), None)
    if exact:
        return exact
    starts = next(
        (a for a in areas if _normalize(a.get("name") or "").startswith(key)),
        None,
    )
    if starts:
        return starts
    containing = [a for a in areas if key in _normalize(a.get("name") or "")]
    if containing:
        return min(containing, key=lambda a: len((a.get("name") or "")))
    return None


def _resolver_par(interest_name: str, area_name: str, interests: list[dict], areas: list[dict]) -> tuple[str, str] | None:
    """Tenta resolver (interesse, área) com busca inteligente. Retorna (nome_interesse, nome_area) ou None."""
    interest = _match_interest_intelligent(interest_name, interests)
    if not interest:
        return None
    interest_id = interest.get("id")
    areas_do_interesse = [a for a in areas if a.get("interestId") == interest_id]
    area = _match_area_intelligent(area_name, areas_do_interesse)
    if not area:
        return None
    return (interest.get("name", interest_name), area.get("name", area_name))


def _resolver_interesse_area(
    interest_name: str,
    area_name: str,
) -> tuple[str, str] | None:
    """
    Resolve um par (interesse, área) válido. Tenta primeiro (interest_name, area_name).
    Se falhar e o nome da área for um interesse existente, tenta (area_name, interest_name)
    para o caso "X > Y" em que o usuário inverteu. Usa busca inteligente e normalização.
    """
    if not (interest_name and interest_name.strip()) or not (area_name and area_name.strip()):
        return None
    interest_name = interest_name.strip()
    area_name = area_name.strip()
    try:
        interests = obsidian_service.listar_interesses()
        areas = obsidian_service.listar_areas()
    except requests.RequestException:
        return None

    par = _resolver_par(interest_name, area_name, interests, areas)
    if par:
        return par
    # Se o usuário disse "X > Y" mas Y é um interesse e X uma área sob Y, tenta invertido
    area_como_interesse = _match_interest_intelligent(area_name, interests)
    if area_como_interesse:
        par = _resolver_par(area_name, interest_name, interests, areas)
        if par:
            return par
    return None


async def _processar_texto_e_responder(texto: str, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Conversa com o usuário e arquiva no Obsidian quando a LLM indicar salvar_ideia."""
    memoria_dados = memory.carregar_memoria()
    interesses_areas = None
    if _parece_pedido_salvar_ideia(texto):
        try:
            logger.info("Buscando interesses/áreas para contextualizar salvamento de ideia...")
            interesses = obsidian_service.listar_interesses()
            areas = obsidian_service.listar_areas()
            interesses_areas = (interesses, areas)
        except requests.RequestException as e:
            logger.warning("Falha ao buscar interesses/áreas do Obsidian: %s", e)
    
    logger.info("Enviando texto para LLM (OpenRouter)...")
    resultado = llm.perguntar_llm(texto, contexto_memoria=memoria_dados, interesses_areas=interesses_areas)
    resposta = resultado.get("resposta", "Ok.")
    acao = resultado.get("acao", "responder")
    dados = resultado.get("dados")
    
    logger.info("Ação identificada: %s", acao)

    try:
        if acao == "salvar_ideia" and dados:
            interest = (dados.get("interest") or "").strip()
            area = (dados.get("area") or "").strip()
            titulo = (dados.get("titulo") or "").strip() or "Sem título"
            corpo = (dados.get("resumo") or "").strip()
            if not corpo and texto.strip():
                linhas = texto.strip().splitlines()
                if not titulo or titulo == "Sem título":
                    titulo = (linhas[0][:255] if linhas else "Sem título").strip() or "Sem título"
                corpo = texto.strip()

            refinado = llm.refinar_ideia(titulo, corpo)
            if refinado:
                titulo = refinado["titulo"]
                descricao = refinado["descricao"]
                corpo_corrigido = refinado["corpo"]
                conteudo_final = f"{descricao}\n\n{corpo_corrigido}".strip()
            else:
                conteudo_final = corpo

            if interest and area:
                par = _resolver_interesse_area(interest, area)
                if not par:
                    try:
                        interesses_fb = obsidian_service.listar_interesses()
                        areas_fb = obsidian_service.listar_areas()
                        fallback = llm.escolher_par_interesse_area_fallback(
                            titulo, conteudo_final or corpo, interest, area, interesses_fb, areas_fb
                        )
                        if fallback:
                            par = _resolver_interesse_area(
                                fallback["interest"], fallback["area"]
                            )
                    except requests.RequestException:
                        pass
                if par:
                    interest_final, area_final = par
                    created = obsidian_service.criar_documento(
                        title=titulo,
                        content=conteudo_final,
                        interest=interest_final,
                        area=area_final,
                        tags=dados.get("tags") or [],
                    )
                    primeira_linha = (conteudo_final or "").strip().split("\n")[0].strip()
                    resumo = primeira_linha[:137] + "..." if len(primeira_linha) > 140 else primeira_linha
                    resposta = (
                        f"{resposta}\n\n✅ Ideia salva.\n"
                        f"• Interesse: {interest_final}\n"
                        f"• Área: {area_final}\n"
                        f"• Título: {titulo}\n"
                        f"• Resumo: {resumo or '(sem resumo)'}"
                    )
                    url = _link(f"ideia/{created.get('id')}") if created and created.get("id") else ""
                    if url:
                        resposta += f"\n\n🔗 {url}"
                else:
                    resposta = (
                        "⚠️ Não foi possível salvar a ideia. Só é possível salvar em um interesse e uma área já cadastrados. "
                        "Pergunte 'quais são minhas categorias' para ver a lista e use um deles."
                    )
            else:
                resposta = (
                    "⚠️ Não foi possível salvar. Toda ideia precisa de um interesse e uma área já existentes. "
                    "Pergunte 'quais são minhas categorias' para ver a lista."
                )
        elif acao == "criar_tarefa_planejamento" and dados:
            title = dados.get("titulo") or dados.get("title") or "Tarefa"
            corrigido = llm.corrigir_titulo_resumo(title)
            if corrigido:
                title = corrigido["titulo"] or title
            status = dados.get("status", "todo")
            priority = dados.get("priority", "medium")
            obsidian_service.criar_card_planejamento(title=title, status=status, priority=priority)
            resposta = f"{resposta}\n\n✅ Tarefa criada no planejamento empresarial."
            url = _link("planejamento-profissional")
            if url:
                resposta += f"\n\n🔗 {url}"
        elif acao == "atualizar_planejamento" and dados:
            card_id = (dados.get("id") or "").strip()
            if not card_id:
                resposta = f"{resposta}\n\n⚠️ Não foi possível atualizar: informe o id da tarefa."
            else:
                payload = {}
                for key in ("titulo", "status", "priority", "isFinalized"):
                    if key in dados:
                        val = dados[key]
                        if key == "titulo": payload["title"] = str(val).strip()
                        elif key == "isFinalized": payload[key] = bool(val)
                        else: payload[key] = str(val).strip()
                if payload:
                    obsidian_service.atualizar_card_planejamento(card_id, payload)
                    resposta = f"{resposta}\n\n✅ Tarefa de planejamento empresarial atualizada."
                else:
                    resposta = f"{resposta}\n\n⚠️ Nenhum campo para atualizar informado."
        elif acao == "criar_tarefa_planejamento_pessoal" and dados:
            title = dados.get("titulo") or dados.get("title") or "Tarefa"
            corrigido = llm.corrigir_titulo_resumo(title)
            if corrigido:
                title = corrigido["titulo"] or title
            status = dados.get("status", "todo")
            priority = dados.get("priority", "medium")
            obsidian_service.criar_card_planejamento_pessoal(title=title, status=status, priority=priority)
            resposta = f"{resposta}\n\n✅ Tarefa criada no planejamento pessoal."
            url = _link("planejamento-pessoal")
            if url:
                resposta += f"\n\n🔗 {url}"
        elif acao == "atualizar_planejamento_pessoal" and dados:
            card_id = (dados.get("id") or "").strip()
            if not card_id:
                resposta = f"{resposta}\n\n⚠️ Não foi possível atualizar: informe o id da tarefa."
            else:
                payload = {}
                for key in ("titulo", "status", "priority", "isFinalized"):
                    if key in dados:
                        val = dados[key]
                        if key == "titulo": payload["title"] = str(val).strip()
                        elif key == "isFinalized": payload[key] = bool(val)
                        else: payload[key] = str(val).strip()
                if payload:
                    obsidian_service.atualizar_card_planejamento_pessoal(card_id, payload)
                    resposta = f"{resposta}\n\n✅ Tarefa de planejamento pessoal atualizada."
                else:
                    resposta = f"{resposta}\n\n⚠️ Nenhum campo para atualizar informado."
        elif acao == "criar_lista" and dados:
            title = (dados.get("titulo") or dados.get("title") or "").strip() or "Sem título"
            corrigido = llm.corrigir_titulo_resumo(title)
            if corrigido:
                title = corrigido["titulo"] or title
            list_type = (dados.get("listType") or dados.get("list_type") or "geral").strip() or "geral"
            items = dados.get("itens") or dados.get("items") or []
            lst = obsidian_service.criar_lista(title=title, list_type=list_type, items=items)
            n = len(lst.get("items", []))
            resposta = f"{resposta}\n\n✅ Lista criada: {title} ({list_type}). {n} item(ns) adicionado(s)."
            url = _link(f"lista/{lst.get('id')}") if lst.get("id") else ""
            if url:
                resposta += f"\n\n🔗 {url}"
        elif acao == "atualizar_ideia" and dados:
            doc_id = (dados.get("id") or "").strip()
            if not doc_id:
                resposta = f"{resposta}\n\n⚠️ Não foi possível atualizar: informe o id da ideia."
            else:
                payload = {}
                if "titulo" in dados:
                    payload["title"] = (dados.get("titulo") or "").strip()
                if "resumo" in dados:
                    payload["content"] = (dados.get("resumo") or "").strip()
                if "interest" in dados:
                    payload["interest"] = (dados.get("interest") or "").strip()
                if "area" in dados:
                    payload["area"] = (dados.get("area") or "").strip()
                if "tags" in dados:
                    payload["tags"] = dados.get("tags") if isinstance(dados.get("tags"), list) else []
                if payload:
                    obsidian_service.atualizar_documento(doc_id, payload)
                    resposta = f"{resposta}\n\n✅ Ideia atualizada."
                else:
                    resposta = f"{resposta}\n\n⚠️ Nenhum campo para atualizar informado."
        elif acao == "criar_lembrete" and dados:
            titulo = (dados.get("titulo") or "").strip()
            if not titulo:
                resposta = f"{resposta}\n\n⚠️ Informe o título do lembrete."
            else:
                body = (dados.get("body") or "").strip()
                corrigido = llm.corrigir_titulo_resumo(titulo, body)
                if corrigido:
                    titulo = corrigido["titulo"] or titulo
                    body = corrigido.get("resumo") if corrigido.get("resumo") is not None else body
                first_due = (dados.get("firstDueAt") or "").strip()
                if not first_due:
                    first_due = __import__("datetime").datetime.utcnow().isoformat() + "Z"
                else:
                    try:
                        dt = __import__("datetime").datetime.fromisoformat(first_due.replace("Z", "+00:00"))
                        first_due = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z") if first_due.endswith("Z") or "+" in first_due else dt.isoformat() + "Z"
                    except (ValueError, TypeError):
                        first_due = __import__("datetime").datetime.utcnow().isoformat() + "Z"
                recurrence = (dados.get("recurrence") or "once").strip()
                if recurrence not in ("once", "daily", "every_2_days", "weekly"):
                    recurrence = "once"
                obsidian_service.criar_lembrete(title=titulo, first_due_at=first_due, body=body, recurrence=recurrence)
                rec_label = {"once": "uma vez", "daily": "diário", "every_2_days": "a cada 2 dias", "weekly": "semanal"}.get(recurrence, "uma vez")
                resposta = f"{resposta}\n\n✅ Lembrete criado ({rec_label})."
                url = _link("lembretes")
                if url:
                    resposta += f"\n\n🔗 {url}"
        elif acao == "atualizar_lembrete" and dados:
            rem_id = (dados.get("id") or "").strip()
            if not rem_id:
                resposta = f"{resposta}\n\n⚠️ Não foi possível atualizar: informe o id do lembrete."
            else:
                payload = {}
                for key in ("titulo", "body", "firstDueAt", "recurrence"):
                    if key in dados:
                        payload[key] = str(dados[key]).strip()
                if payload:
                    obsidian_service.atualizar_lembrete(rem_id, payload)
                    resposta = f"{resposta}\n\n✅ Lembrete atualizado."
                else:
                    resposta = f"{resposta}\n\n⚠️ Nenhum campo para atualizar informado."
        elif acao == "lançar_lembretes":
            try:
                vencidos = obsidian_service.listar_lembretes_vencidos()
                if not vencidos:
                    resposta = f"{resposta}\n\nNenhum lembrete vencido no momento."
                else:
                    for r in vencidos:
                        msg = f"🔔 {r.get('title', 'Lembrete')}"
                        if r.get("body"):
                            msg += f"\n{r['body']}"
                        await update.message.reply_text(msg)
                        obsidian_service.marcar_lembrete_disparado(r["id"])
                    resposta = f"{resposta}\n\n✅ {len(vencidos)} lembrete(s) enviado(s)."
            except requests.RequestException as e:
                logger.warning("Erro ao buscar/enviar lembretes: %s", e)
                resposta = f"{resposta}\n\n⚠️ Não foi possível verificar lembretes (servidor)."
        elif acao == "atualizar_lista" and dados:
            list_id = (dados.get("id") or "").strip()
            if not list_id:
                resposta = f"{resposta}\n\n⚠️ Não foi possível atualizar: informe o id da lista."
            else:
                item_id = (dados.get("itemId") or dados.get("item_id") or "").strip()
                if item_id and ("done" in dados or "label" in dados):
                    kwargs = {}
                    if "done" in dados:
                        kwargs["done"] = bool(dados["done"])
                    if "label" in dados:
                        kwargs["label"] = (dados.get("label") or "").strip()
                    if kwargs:
                        obsidian_service.atualizar_item_lista(list_id, item_id, **kwargs)
                        resposta = f"{resposta}\n\n✅ Item da lista atualizado."
                else:
                    payload = {}
                    if "titulo" in dados:
                        payload["title"] = (dados.get("titulo") or "").strip()
                    if "listType" in dados or "list_type" in dados:
                        payload["listType"] = (dados.get("listType") or dados.get("list_type") or "geral").strip()
                    if "itens" in dados or "items" in dados:
                        raw = dados.get("itens") or dados.get("items") or []
                        if isinstance(raw, list) and raw:
                            now = __import__("datetime").datetime.utcnow().isoformat()
                            items = []
                            for i, it in enumerate(raw):
                                if isinstance(it, dict):
                                    iid = it.get("id") or __import__("uuid").uuid4()
                                    items.append({
                                        "id": str(iid) if iid else str(__import__("uuid").uuid4()),
                                        "listId": list_id,
                                        "label": (it.get("label") or "").strip() or "(item)",
                                        "order": it.get("order", i),
                                        "done": bool(it.get("done", False)),
                                        "createdAt": it.get("createdAt") or now,
                                    })
                                elif isinstance(it, str):
                                    items.append({
                                        "id": str(__import__("uuid").uuid4()),
                                        "listId": list_id,
                                        "label": (it or "").strip() or "(item)",
                                        "order": i,
                                        "done": False,
                                        "createdAt": now,
                                    })
                            payload["items"] = items
                    if payload:
                        obsidian_service.atualizar_lista(list_id, payload)
                        resposta = f"{resposta}\n\n✅ Lista atualizada."
                    else:
                        resposta = f"{resposta}\n\n⚠️ Nenhum campo para atualizar informado."
        elif acao == "listar_planejamentos_empresariais":
            try:
                cards = obsidian_service.listar_cards_planejamento()
                if not cards:
                    resposta = f"{resposta}\n\nNenhum planejamento empresarial no momento."
                else:
                    cards_abertos = [c for c in cards if not c.get("isFinalized")]
                    if not cards_abertos:
                        resposta = f"{resposta}\n\nTodos os planejamentos empresariais estão concluídos."
                    else:
                        linhas = [f"💼 Planejamento Empresarial ({len(cards_abertos)} ativos):"]
                        for c in cards_abertos:
                            linhas.append(f"• {c.get('title', 'Sem título')} (Prioridade: {c.get('priority', 'medium')})")
                        resposta = f"{resposta}\n\n" + "\n".join(linhas)
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar planejamentos empresariais."
        elif acao == "listar_planejamentos_pessoais":
            try:
                cards = obsidian_service.listar_cards_planejamento_pessoal()
                if not cards:
                    resposta = f"{resposta}\n\nNenhum planejamento pessoal no momento."
                else:
                    cards_abertos = [c for c in cards if not c.get("isFinalized")]
                    if not cards_abertos:
                        resposta = f"{resposta}\n\nTodos os planejamentos pessoais estão concluídos."
                    else:
                        linhas = [f"👤 Planejamento Pessoal ({len(cards_abertos)} ativos):"]
                        for c in cards_abertos:
                            linhas.append(f"• {c.get('title', 'Sem título')} (Prioridade: {c.get('priority', 'medium')})")
                        resposta = f"{resposta}\n\n" + "\n".join(linhas)
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar planejamentos pessoais."
        elif acao == "listar_lembretes_ativos":
            try:
                lembretes = obsidian_service.listar_lembretes()
                if not lembretes:
                    resposta = f"{resposta}\n\nNenhum lembrete cadastrado."
                else:
                    linhas = [f"⏰ Seus Lembretes ({len(lembretes)}):"]
                    for rm in lembretes:
                        linhas.append(f"• {rm.get('title', 'Lembrete')}")
                    resposta = f"{resposta}\n\n" + "\n".join(linhas)
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar lembretes."
        elif acao == "listar_listas":
            try:
                listas = obsidian_service.listar_listas()
                if not listas:
                    resposta = f"{resposta}\n\nNenhuma lista cadastrada."
                else:
                    linhas = [f"📋 Suas Listas ({len(listas)}):"]
                    for lst in listas:
                        items = lst.get("items", [])
                        pendentes = len([i for i in items if not i.get("done")])
                        linhas.append(f"• {lst.get('title', 'Sem título')} ({pendentes}/{len(items)} pendentes)")
                    resposta = f"{resposta}\n\n" + "\n".join(linhas)
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar listas."
        elif acao == "listar_categorias":
            try:
                interesses = obsidian_service.listar_interesses()
                areas = obsidian_service.listar_areas()
                cats = _formatar_lista_interesses_areas(interesses, areas)
                resposta = f"{resposta}\n\n{cats}"
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar categorias."
        elif acao == "buscar_ideia" and dados:
            termo = str(dados.get("termo") or "").strip().lower()
            try:
                docs = obsidian_service.listar_documentos()
                if not docs:
                    resposta = f"{resposta}\n\nNenhuma ideia cadastrada no banco."
                else:
                    encontradas = [d for d in docs if termo in d.get("title", "").lower() or termo in d.get("content", "").lower()]
                    if not encontradas:
                        resposta = f"{resposta}\n\nNenhuma ideia encontrada com '{termo}'."
                    else:
                        top = encontradas[:3]
                        linhas = [f"🔍 Ideias encontradas ({len(encontradas)}):"]
                        for d in top:
                            t = d.get("title", "Sem título")
                            a = d.get("area", "")
                            i = d.get("interest", "")
                            url = _link(f"ideia/{d.get('id')}")
                            linhas.append(f"• {t} ({i} > {a})")
                            if url:
                                linhas.append(f"  🔗 {url}")
                        if len(encontradas) > 3:
                            linhas.append(f"...e mais {len(encontradas)-3} ideias.")
                        resposta = f"{resposta}\n\n" + "\n".join(linhas)
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar ideias."
        else:
            # default: just reply
            pass
    except requests.RequestException as e:
        logger.exception("Erro ao comunicar com Obsidian backend: %s", e)
        resposta = f"{resposta}\n\n⚠️ Não foi possível gravar no Obsidian (verifique servidor)."
    if acao == "responder" and _parece_pergunta_funcao(texto):
        base = getattr(config, "APP_BASE_URL", "") or ""
        if base:
            resposta += f"\n\n🔗 Acesse o app: {base}"
    await update.message.reply_text(resposta)


def _verificar_acesso(update: Update) -> bool:
    """Retorna True se o usuário está na lista de permitidos ou se a lista está vazia."""
    user = update.effective_user
    if not config.ALLOWED_TELEGRAM_USERS:
        return True
    if not user:
        return False
    username = (user.username or "").lstrip("@")
    user_id = str(user.id)
    return username in config.ALLOWED_TELEGRAM_USERS or user_id in config.ALLOWED_TELEGRAM_USERS


async def handler_mensagem_texto(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para mensagens de texto."""
    if not _verificar_acesso(update):
        logger.warning("Mensagem bloqueada para usuário: %s (%s)", update.effective_user.username, update.effective_user.id)
        return
    if not update.message or not update.message.text:
        return
    texto = update.message.text.strip()
    if not texto:
        return
    logger.info("Nova mensagem de %s: %r", update.effective_user.username, texto)
    try:
        # Check for pending confirmation first
        pending = memory.get_pending_action()
        low = texto.lower().strip()
        if pending and low in ("não", "nao", "n", "cancelar"):
            memory.clear_pending_action()
            await update.message.reply_text("Ok — não criei nada.")
            return

        if _parece_pergunta_interesses_areas(texto):
            try:
                interesses = obsidian_service.listar_interesses()
                areas = obsidian_service.listar_areas()
                await update.message.reply_text(_formatar_lista_interesses_areas(interesses, areas))
            except requests.RequestException:
                await update.message.reply_text("⚠️ Não consegui carregar interesses/áreas agora (servidor offline).")
            return

        await _processar_texto_e_responder(texto, update, context)
    except Exception as e:
        logger.exception("Erro ao processar mensagem de texto: %s", e)
        await update.message.reply_text(RESPOSTA_ERRO)


async def handler_mensagem_voz(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para mensagens de áudio (voice)."""
    if not _verificar_acesso(update):
        logger.warning("Mensagem de voz bloqueada para usuário: %s (%s)", update.effective_user.username, update.effective_user.id)
        return
    if not update.message or not update.message.voice:
        return
    voice = update.message.voice
    temp_ogg = None
    temp_wav = None
    try:
        temp_ogg = await audio.baixar_arquivo_voice(voice.file_id, context.bot)
        temp_wav = audio.ogg_para_wav(temp_ogg)
        texto = audio.transcrever(temp_wav)
        if not (texto and texto.strip()):
            await update.message.reply_text("Não foi possível transcrever o áudio.")
            return
        texto = texto.strip()
        if _parece_pergunta_interesses_areas(texto):
            try:
                interesses = obsidian_service.listar_interesses()
                areas = obsidian_service.listar_areas()
                await update.message.reply_text(_formatar_lista_interesses_areas(interesses, areas))
            except requests.RequestException:
                await update.message.reply_text("⚠️ Não consegui carregar interesses/áreas agora (servidor offline).")
            return
        await _processar_texto_e_responder(texto, update, context)
    except audio.FFmpegNotFoundError:
        await update.message.reply_text(
            "Para usar mensagens de voz, instale o FFmpeg e adicione ao PATH do sistema.\n\n"
            "No Windows: abra o Terminal e execute:\n"
            "winget install ffmpeg\n\n"
            "Depois feche e abra o terminal novamente e reinicie o bot."
        )
    except NotImplementedError as e:
        logger.warning("%s", e)
        await update.message.reply_text(
            "Transcrição de áudio ainda não configurada. Envie apenas texto ou configure uma API em assistant/audio.py."
        )
    except Exception as e:
        logger.exception("Erro ao processar áudio: %s", e)
        await update.message.reply_text(RESPOSTA_ERRO)
    finally:
        for path in (temp_ogg, temp_wav):
            if path and Path(path).exists():
                try:
                    os.unlink(path)
                except OSError:
                    pass


async def _job_lembretes_vencidos(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Job periódico: envia lembretes vencidos para TELEGRAM_CHAT_ID."""
    chat_id = getattr(config, "TELEGRAM_CHAT_ID", "") or ""
    if not chat_id:
        return
    try:
        vencidos = obsidian_service.listar_lembretes_vencidos()
        for r in vencidos:
            msg = f"🔔 {r.get('title', 'Lembrete')}"
            if r.get("body"):
                msg += f"\n{r['body']}"
            await context.bot.send_message(chat_id=chat_id, text=msg)
            obsidian_service.marcar_lembrete_disparado(r["id"])
    except requests.RequestException as e:
        logger.debug("Job lembretes: %s", e)
    except Exception as e:
        logger.warning("Job lembretes: %s", e)


def main() -> None:
    """Valida config, monta a aplicação e inicia o polling."""
    config.validar_config()
    # Diagnóstico: confirma se a chave OpenRouter está presente (sem expor o valor)
    key = getattr(config, "OPENROUTER_API_KEY", "") or ""
    logger.info(
        "OPENROUTER_API_KEY definida: %s (len=%d)",
        "sim" if key.strip() else "não",
        len(key),
    )
    # Validação mínima: OBSIDIAN_API_BASE_URL deve estar configurado via assistant.config
    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handler_mensagem_texto))
    app.add_handler(MessageHandler(filters.VOICE, handler_mensagem_voz))
    if getattr(config, "TELEGRAM_CHAT_ID", "") and config.TELEGRAM_CHAT_ID.strip():
        app.job_queue.run_repeating(_job_lembretes_vencidos, interval=60, first=30)
        logger.info("Job de lembretes ativo (TELEGRAM_CHAT_ID definido).")
    logger.info("Bot iniciando...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
