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
import re
import tempfile
import datetime
from pathlib import Path

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

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

# Regex para captura rápida sem LLM: "salvar em X > Y: texto"
_RE_CAPTURA_RAPIDA = re.compile(
    r'^(?:salvar|anotar|guardar|registrar)\s+em\s+(.+?)\s*[>\/]\s*(.+?):\s*(.+)',
    re.IGNORECASE | re.DOTALL,
)


def _link(path: str) -> str:
    """Retorna URL completa do app para o path (ex.: ideia/123, listas). Se APP_BASE_URL não estiver definido, retorna vazio."""
    base = getattr(config, "APP_BASE_URL", "") or ""
    if not base:
        return ""
    return f"{base}/{path.lstrip('/')}"


# Palavras que indicam pedido de salvar/guardar ideia (para buscar interesses e áreas)
_PALAVRAS_SALVAR_IDEIA = ("guardar", "salvar", "anotar", "ideia", "nota", "registrar", "gravar")

# Palavras que indicam CONSULTA (não criação) de planejamento empresarial
_PALAVRAS_LISTAR_EMPRESARIAL = (
    "planejamento empresarial", "planejamentos empresariais",
    "tarefas empresariais", "tarefa empresarial",
    "projetos empresariais", "projeto empresarial",
    "meus projetos empr", "registrado nos projetos",
    "tenho no planejamento empr", "tenho registrado empr",
)

# Palavras que indicam CONSULTA (não criação) de planejamento pessoal
_PALAVRAS_LISTAR_PESSOAL = (
    "planejamento pessoal", "planejamentos pessoais",
    "tarefas pessoais", "tarefa pessoal",
    "projetos pessoais", "projeto pessoal",
    "tenho no planejamento pessoal", "tenho registrado pessoal",
)

# Palavras que indicam intenção de CONSULTA (não criação)
_PALAVRAS_CONSULTA = (
    "quais são", "quais sao", "o que tenho", "o que eu tenho",
    "me mostre", "me mostra", "liste", "listar", "mostrar",
    "tenho registrado", "tenho cadastrado", "registrado",
    "cadastrado", "ver meus", "ver as", "ver os",
    "quais", "me diga", "me fala",
)

# Palavras que indicam consulta de tarefas diárias
_PALAVRAS_TAREFAS_DIARIAS = (
    "tarefa de hoje", "tarefas de hoje", "task de hoje",
    "o que tenho hoje", "lista de hoje", "tarefas diárias", "tarefas diarias",
)


def _parece_consulta_planejamento_empresarial(texto: str) -> bool:
    """True se a mensagem parece CONSULTAR (não criar) tarefas do planejamento empresarial."""
    t = texto.lower().strip()
    tem_empresarial = any(k in t for k in _PALAVRAS_LISTAR_EMPRESARIAL)
    if tem_empresarial:
        tem_consulta = any(k in t for k in _PALAVRAS_CONSULTA)
        sem_criar = not any(k in t for k in ("criar", "adicionar", "novo", "nova", "criar tarefa", "adicione", "crie"))
        return tem_consulta or sem_criar
    return False


def _parece_consulta_planejamento_pessoal(texto: str) -> bool:
    """True se a mensagem parece CONSULTAR (não criar) tarefas do planejamento pessoal."""
    t = texto.lower().strip()
    tem_pessoal = any(k in t for k in _PALAVRAS_LISTAR_PESSOAL)
    if tem_pessoal:
        tem_consulta = any(k in t for k in _PALAVRAS_CONSULTA)
        sem_criar = not any(k in t for k in ("criar", "adicionar", "novo", "nova", "criar tarefa", "adicione", "crie"))
        return tem_consulta or sem_criar
    return False


def _parece_consulta_tarefas_diarias(texto: str) -> bool:
    """True se a mensagem parece consultar tarefas diárias."""
    t = texto.lower().strip()
    return any(k in t for k in _PALAVRAS_TAREFAS_DIARIAS)


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


def _tentar_captura_rapida(texto: str) -> dict | None:
    """
    Tenta capturar rapidamente sem LLM se o texto seguir o padrão:
    'salvar/anotar/guardar em X > Y: texto da ideia'
    Retorna dict com acao='captura_rapida' ou None se não combinar.
    """
    m = _RE_CAPTURA_RAPIDA.match(texto.strip())
    if not m:
        return None
    return {
        "acao": "captura_rapida",
        "interest": m.group(1).strip(),
        "area": m.group(2).strip(),
        "texto": m.group(3).strip(),
    }


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


def _formatar_cards(cards: list[dict], emoji: str, titulo: str) -> str:
    """Formata lista de cards de planejamento com ID curto para referência."""
    cards_abertos = [c for c in cards if not c.get("isFinalized")]
    cards_finalizados = [c for c in cards if c.get("isFinalized")]
    if not cards_abertos:
        return f"✅ Todos os {titulo.lower()} estão concluídos!"
    linhas = [f"{emoji} {titulo} ({len(cards_abertos)} ativo(s)):"]
    for c in cards_abertos:
        prioridade = {"high": "🔴 Alta", "medium": "🟡 Média", "low": "🟢 Baixa"}.get(
            c.get("priority", ""), c.get("priority", "Média")
        )
        status_label = {"todo": "A fazer", "in_progress": "Em andamento", "done": "Concluído"}.get(
            c.get("status", ""), c.get("status", "")
        )
        id_curto = (c.get("id") or "")[:8]
        linhas.append(f"• {c.get('title', 'Sem título')} | {prioridade} | {status_label} | id: {id_curto}")
    if cards_finalizados:
        linhas.append(f"\n✅ {len(cards_finalizados)} tarefa(s) finalizada(s).")
    return "\n".join(linhas)


def _formatar_lembretes(lembretes: list[dict]) -> str:
    """Formata lista de lembretes com ID curto para referência."""
    if not lembretes:
        return "Nenhum lembrete cadastrado."
    linhas = [f"⏰ Seus Lembretes ({len(lembretes)}):"]
    for rm in lembretes:
        id_curto = (rm.get("id") or "")[:8]
        rec = {"once": "uma vez", "daily": "diário", "every_2_days": "a cada 2 dias", "weekly": "semanal"}.get(
            rm.get("recurrence", "once"), "uma vez"
        )
        due = (rm.get("firstDueAt") or "")[:16].replace("T", " ")
        linhas.append(f"• {rm.get('title', 'Lembrete')} | {rec} | {due} | id: {id_curto}")
    return "\n".join(linhas)


def _formatar_tarefas_diarias(tarefas: list[dict]) -> str:
    """Formata lista de tarefas diárias."""
    if not tarefas:
        return "Nenhuma tarefa para hoje."
    pendentes = [t for t in tarefas if not t.get("done")]
    concluidas = [t for t in tarefas if t.get("done")]
    linhas = [f"📋 Tarefas de Hoje ({len(pendentes)} pendente(s) / {len(concluidas)} concluída(s)):"]
    for t in pendentes:
        id_curto = (t.get("id") or "")[:8]
        linhas.append(f"• ⬜ {t.get('title', 'Tarefa')} | id: {id_curto}")
    for t in concluidas:
        id_curto = (t.get("id") or "")[:8]
        linhas.append(f"• ✅ {t.get('title', 'Tarefa')} | id: {id_curto}")
    return "\n".join(linhas)


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
    area_como_interesse = _match_interest_intelligent(area_name, interests)
    if area_como_interesse:
        par = _resolver_par(area_name, interest_name, interests, areas)
        if par:
            return par
    return None


async def _salvar_ideia_com_contexto(
    interest: str,
    area: str,
    titulo: str,
    corpo: str,
    tags: list,
    texto_original: str,
    update: Update,
) -> str:
    """Salva uma ideia resolvendo o par interesse/área e refinando o conteúdo. Retorna a resposta."""
    if not corpo and texto_original.strip():
        linhas = texto_original.strip().splitlines()
        if not titulo or titulo == "Sem título":
            titulo = (linhas[0][:255] if linhas else "Sem título").strip() or "Sem título"
        corpo = texto_original.strip()

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
                    par = _resolver_interesse_area(fallback["interest"], fallback["area"])
            except requests.RequestException:
                pass
        if par:
            interest_final, area_final = par
            created = obsidian_service.criar_documento(
                title=titulo,
                content=conteudo_final,
                interest=interest_final,
                area=area_final,
                tags=tags or [],
            )
            memory.atualizar_contexto_recente("salvar_ideia", {"interest": interest_final, "area": area_final, "titulo": titulo})
            primeira_linha = (conteudo_final or "").strip().split("\n")[0].strip()
            resumo = primeira_linha[:137] + "..." if len(primeira_linha) > 140 else primeira_linha
            resposta = (
                f"✅ Ideia salva.\n"
                f"• Interesse: {interest_final}\n"
                f"• Área: {area_final}\n"
                f"• Título: {titulo}\n"
                f"• Resumo: {resumo or '(sem resumo)'}"
            )
            url = _link(f"ideia/{created.get('id')}") if created and created.get("id") else ""
            if url:
                resposta += f"\n\n🔗 {url}"
            return resposta
        else:
            return (
                "⚠️ Não foi possível salvar a ideia. Só é possível salvar em um interesse e uma área já cadastrados. "
                "Pergunte 'quais são minhas categorias' para ver a lista e use um deles."
            )
    else:
        return (
            "⚠️ Não foi possível salvar. Toda ideia precisa de um interesse e uma área já existentes. "
            "Pergunte 'quais são minhas categorias' para ver a lista."
        )


async def _executar_acao_confirmada(pending: dict, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Executa uma ação que estava aguardando confirmação do usuário."""
    acao = pending.get("acao", "")
    dados = pending.get("dados") or {}

    try:
        if acao == "excluir_ideia":
            doc_id = dados.get("id", "")
            titulo = dados.get("titulo", "essa ideia")
            obsidian_service.deletar_documento(doc_id)
            memory.atualizar_contexto_recente("excluir_ideia")
            await update.message.reply_text(f"🗑️ Ideia '{titulo}' excluída com sucesso.")
        elif acao == "excluir_tarefa_empresarial":
            card_id = dados.get("id", "")
            titulo = dados.get("titulo", "essa tarefa")
            obsidian_service.deletar_card_planejamento(card_id)
            memory.atualizar_contexto_recente("excluir_tarefa_empresarial")
            await update.message.reply_text(f"🗑️ Tarefa empresarial '{titulo}' excluída com sucesso.")
        elif acao == "excluir_tarefa_pessoal":
            card_id = dados.get("id", "")
            titulo = dados.get("titulo", "essa tarefa")
            obsidian_service.deletar_card_planejamento_pessoal(card_id)
            memory.atualizar_contexto_recente("excluir_tarefa_pessoal")
            await update.message.reply_text(f"🗑️ Tarefa pessoal '{titulo}' excluída com sucesso.")
        elif acao == "excluir_lembrete":
            rem_id = dados.get("id", "")
            titulo = dados.get("titulo", "esse lembrete")
            obsidian_service.deletar_lembrete(rem_id)
            memory.atualizar_contexto_recente("excluir_lembrete")
            await update.message.reply_text(f"🗑️ Lembrete '{titulo}' excluído com sucesso.")
        else:
            await update.message.reply_text("⚠️ Ação confirmada, mas não reconhecida.")
    except requests.RequestException as e:
        logger.exception("Erro ao executar ação confirmada '%s': %s", acao, e)
        await update.message.reply_text("⚠️ Erro ao executar a operação. Verifique o servidor.")


async def _processar_texto_e_responder(texto: str, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Conversa com o usuário e arquiva no Obsidian quando a LLM indicar salvar_ideia."""
    # Captura rápida: bypass do LLM para formato explícito "salvar em X > Y: texto"
    captura = _tentar_captura_rapida(texto)
    if captura:
        logger.info("Captura rápida detectada (sem LLM): %s > %s", captura["interest"], captura["area"])
        resposta = await _salvar_ideia_com_contexto(
            interest=captura["interest"],
            area=captura["area"],
            titulo="",
            corpo=captura["texto"],
            tags=[],
            texto_original=captura["texto"],
            update=update,
        )
        await update.message.reply_text(resposta)
        return

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
            resposta = await _salvar_ideia_com_contexto(
                interest=interest,
                area=area,
                titulo=titulo,
                corpo=corpo,
                tags=dados.get("tags") or [],
                texto_original=texto,
                update=update,
            )
        elif acao == "criar_tarefa_planejamento" and dados:
            title = dados.get("titulo") or dados.get("title") or "Tarefa"
            corrigido = llm.corrigir_titulo_resumo(title)
            if corrigido:
                title = corrigido["titulo"] or title
            status = dados.get("status", "todo")
            priority = dados.get("priority", "medium")
            obsidian_service.criar_card_planejamento(title=title, status=status, priority=priority)
            memory.atualizar_contexto_recente("criar_tarefa_planejamento")
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
            memory.atualizar_contexto_recente("criar_tarefa_planejamento_pessoal")
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
                    first_due = datetime.datetime.utcnow().isoformat() + "Z"
                else:
                    try:
                        import datetime as _dt
                        _raw = first_due
                        if _raw.endswith("Z") or "+" in _raw[10:] or "-" in _raw[10:]:
                            _dtobj = _dt.datetime.fromisoformat(_raw.replace("Z", "+00:00"))
                            if _dtobj.tzinfo is not None:
                                _dtobj = _dtobj.utctimetuple()
                                _dtobj = _dt.datetime(*_dtobj[:6], tzinfo=_dt.timezone.utc)
                            first_due = _dtobj.strftime("%Y-%m-%dT%H:%M:%S.000Z")
                        else:
                            _BRASILIA = _dt.timezone(_dt.timedelta(hours=-3))
                            _dtobj = _dt.datetime.fromisoformat(_raw).replace(tzinfo=_BRASILIA)
                            _dtutc = _dtobj.astimezone(_dt.timezone.utc)
                            first_due = _dtutc.strftime("%Y-%m-%dT%H:%M:%S.000Z")
                            logger.info("firstDueAt sem offset interpretado como Brasília (UTC-3): %s → %s", _raw, first_due)
                    except (ValueError, TypeError) as _e:
                        logger.warning("Falha ao parsear firstDueAt '%s': %s. Usando now UTC.", first_due, _e)
                        first_due = datetime.datetime.utcnow().isoformat() + "Z"
                recurrence = (dados.get("recurrence") or "once").strip()
                if recurrence not in ("once", "daily", "every_2_days", "weekly"):
                    recurrence = "once"
                obsidian_service.criar_lembrete(title=titulo, first_due_at=first_due, body=body, recurrence=recurrence)
                memory.atualizar_contexto_recente("criar_lembrete")
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
        elif acao == "listar_planejamentos_empresariais":
            try:
                cards = obsidian_service.listar_cards_planejamento()
                if not cards:
                    resposta = f"{resposta}\n\nNenhum planejamento empresarial no momento."
                else:
                    resposta = f"{resposta}\n\n{_formatar_cards(cards, '💼', 'Planejamento Empresarial')}"
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar planejamentos empresariais."
        elif acao == "listar_planejamentos_pessoais":
            try:
                cards = obsidian_service.listar_cards_planejamento_pessoal()
                if not cards:
                    resposta = f"{resposta}\n\nNenhum planejamento pessoal no momento."
                else:
                    resposta = f"{resposta}\n\n{_formatar_cards(cards, '👤', 'Planejamento Pessoal')}"
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar planejamentos pessoais."
        elif acao == "listar_lembretes_ativos":
            try:
                lembretes = obsidian_service.listar_lembretes()
                resposta = f"{resposta}\n\n{_formatar_lembretes(lembretes)}"
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar lembretes."
        elif acao == "listar_categorias":
            try:
                interesses = obsidian_service.listar_interesses()
                areas = obsidian_service.listar_areas()
                cats = _formatar_lista_interesses_areas(interesses, areas)
                resposta = f"{resposta}\n\n{cats}"
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar categorias."
        elif acao == "buscar_ideia" and dados:
            termo = str(dados.get("termo") or "").strip()
            interest_filtro = str(dados.get("interest") or "").strip()
            area_filtro = str(dados.get("area") or "").strip()
            tag_filtro = str(dados.get("tag") or "").strip()
            try:
                # Usar busca server-side se disponível, senão fallback local
                try:
                    docs = obsidian_service.buscar_documentos(
                        termo=termo, interest=interest_filtro, area=area_filtro, tag=tag_filtro
                    )
                except requests.RequestException:
                    docs = obsidian_service.listar_documentos()
                    t_lower = termo.lower()
                    docs = [d for d in docs if t_lower in d.get("title", "").lower() or t_lower in d.get("content", "").lower()]

                if not docs:
                    resposta = f"{resposta}\n\nNenhuma ideia encontrada com '{termo}'."
                else:
                    top = docs[:3]
                    linhas = [f"🔍 Ideias encontradas ({len(docs)}):"]
                    for d in top:
                        t = d.get("title", "Sem título")
                        a = d.get("area", "")
                        i = d.get("interest", "")
                        id_curto = (d.get("id") or "")[:8]
                        url = _link(f"ideia/{d.get('id')}")
                        linhas.append(f"• {t} ({i} > {a}) | id: {id_curto}")
                        if url:
                            linhas.append(f"  🔗 {url}")
                    if len(docs) > 3:
                        linhas.append(f"...e mais {len(docs)-3} ideias.")
                    resposta = f"{resposta}\n\n" + "\n".join(linhas)
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar ideias."
        elif acao in ("excluir_ideia", "excluir_tarefa_empresarial", "excluir_tarefa_pessoal", "excluir_lembrete") and dados:
            # Solicita confirmação antes de excluir
            item_id = (dados.get("id") or "").strip()
            titulo_item = (dados.get("titulo") or "esse item").strip()
            if not item_id:
                resposta = f"{resposta}\n\n⚠️ Informe o id do item a excluir."
            else:
                memory.set_pending_action({"acao": acao, "dados": dados})
                tipo_label = {
                    "excluir_ideia": "a ideia",
                    "excluir_tarefa_empresarial": "a tarefa empresarial",
                    "excluir_tarefa_pessoal": "a tarefa pessoal",
                    "excluir_lembrete": "o lembrete",
                }.get(acao, "o item")
                resposta = (
                    f"⚠️ Tem certeza que deseja excluir {tipo_label} '{titulo_item}'?\n"
                    f"Responda 'sim' para confirmar ou 'não' para cancelar."
                )
        elif acao == "criar_tarefa_diaria" and dados:
            titulo = (dados.get("titulo") or "").strip()
            if not titulo:
                resposta = f"{resposta}\n\n⚠️ Informe o título da tarefa."
            else:
                obsidian_service.criar_tarefa_diaria(titulo)
                memory.atualizar_contexto_recente("criar_tarefa_diaria")
                resposta = f"{resposta}\n\n✅ Tarefa diária criada: {titulo}"
        elif acao == "concluir_tarefa_diaria" and dados:
            task_id = (dados.get("id") or "").strip()
            if not task_id:
                resposta = f"{resposta}\n\n⚠️ Informe o id da tarefa diária."
            else:
                obsidian_service.atualizar_tarefa_diaria(task_id, done=True)
                resposta = f"{resposta}\n\n✅ Tarefa marcada como concluída."
        elif acao == "listar_tarefas_diarias":
            try:
                tarefas = obsidian_service.listar_tarefas_diarias()
                resposta = f"{resposta}\n\n{_formatar_tarefas_diarias(tarefas)}"
            except requests.RequestException:
                resposta = f"{resposta}\n\n⚠️ Erro ao buscar tarefas diárias."
        else:
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


# ─────────────────────────── Slash command handlers ───────────────────────────

async def handler_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para /start — apresenta o bot e lista os comandos disponíveis."""
    if not _verificar_acesso(update):
        return
    msg = (
        "👋 Olá! Sou sua secretária pessoal.\n\n"
        "📋 *Comandos disponíveis:*\n"
        "/briefing — Resumo do dia (lembretes, tarefas prioritárias, ideias recentes)\n"
        "/empresarial — Listar planejamento empresarial\n"
        "/pessoal — Listar planejamento pessoal\n"
        "/lembretes — Listar todos os lembretes\n"
        "/hoje — Listar tarefas de hoje\n"
        "/categorias — Listar interesses e áreas\n\n"
        "💬 *Ou envie mensagem de texto/voz:*\n"
        "• 'guardar em Naxtool > Sistemas: ideia...'\n"
        "• 'criar tarefa empresarial: revisar relatório'\n"
        "• 'me lembre amanhã às 9h de ligar para X'\n"
        "• 'excluir lembrete id a3f9c1d2'"
    )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def handler_empresarial(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para /empresarial — lista planejamento empresarial sem LLM."""
    if not _verificar_acesso(update):
        return
    try:
        cards = obsidian_service.listar_cards_planejamento()
        if not cards:
            await update.message.reply_text("❌ Nenhum projeto empresarial criado até o momento.")
        else:
            await update.message.reply_text(_formatar_cards(cards, "💼", "Planejamento Empresarial"))
    except requests.RequestException as e:
        logger.warning("Erro ao buscar planejamentos empresariais: %s", e)
        await update.message.reply_text("⚠️ Não consegui carregar o planejamento empresarial (servidor offline).")


async def handler_pessoal(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para /pessoal — lista planejamento pessoal sem LLM."""
    if not _verificar_acesso(update):
        return
    try:
        cards = obsidian_service.listar_cards_planejamento_pessoal()
        if not cards:
            await update.message.reply_text("❌ Nenhum projeto pessoal criado até o momento.")
        else:
            await update.message.reply_text(_formatar_cards(cards, "👤", "Planejamento Pessoal"))
    except requests.RequestException as e:
        logger.warning("Erro ao buscar planejamentos pessoais: %s", e)
        await update.message.reply_text("⚠️ Não consegui carregar o planejamento pessoal (servidor offline).")


async def handler_lembretes(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para /lembretes — lista todos os lembretes sem LLM."""
    if not _verificar_acesso(update):
        return
    try:
        lembretes = obsidian_service.listar_lembretes()
        await update.message.reply_text(_formatar_lembretes(lembretes))
    except requests.RequestException as e:
        logger.warning("Erro ao buscar lembretes: %s", e)
        await update.message.reply_text("⚠️ Não consegui carregar os lembretes (servidor offline).")


async def handler_hoje(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para /hoje — lista tarefas diárias de hoje sem LLM."""
    if not _verificar_acesso(update):
        return
    try:
        tarefas = obsidian_service.listar_tarefas_diarias()
        await update.message.reply_text(_formatar_tarefas_diarias(tarefas))
    except requests.RequestException as e:
        logger.warning("Erro ao buscar tarefas diárias: %s", e)
        await update.message.reply_text("⚠️ Não consegui carregar as tarefas de hoje (servidor offline).")


async def handler_categorias(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para /categorias — lista interesses e áreas sem LLM."""
    if not _verificar_acesso(update):
        return
    try:
        interesses = obsidian_service.listar_interesses()
        areas = obsidian_service.listar_areas()
        await update.message.reply_text(_formatar_lista_interesses_areas(interesses, areas))
    except requests.RequestException:
        await update.message.reply_text("⚠️ Não consegui carregar interesses/áreas agora (servidor offline).")


async def _montar_briefing() -> str:
    """Monta o texto do briefing diário com lembretes, tarefas prioritárias e contagem de ideias."""
    linhas = ["📅 *Briefing do Dia*\n"]

    # Lembretes vencidos
    try:
        vencidos = obsidian_service.listar_lembretes_vencidos()
        if vencidos:
            linhas.append(f"🔔 *{len(vencidos)} lembrete(s) vencido(s):*")
            for r in vencidos[:5]:
                linhas.append(f"  • {r.get('title', 'Lembrete')}")
            if len(vencidos) > 5:
                linhas.append(f"  ...e mais {len(vencidos) - 5}")
            linhas.append("")
    except requests.RequestException:
        pass

    # Tarefas de alta prioridade
    try:
        cards_emp = obsidian_service.listar_cards_planejamento()
        alta_emp = [c for c in cards_emp if not c.get("isFinalized") and c.get("priority") == "high"]
        if alta_emp:
            linhas.append(f"💼 *{len(alta_emp)} tarefa(s) empresarial(is) de alta prioridade:*")
            for c in alta_emp[:5]:
                id_curto = (c.get("id") or "")[:8]
                linhas.append(f"  • {c.get('title', 'Tarefa')} | id: {id_curto}")
            linhas.append("")
    except requests.RequestException:
        pass

    try:
        cards_pes = obsidian_service.listar_cards_planejamento_pessoal()
        alta_pes = [c for c in cards_pes if not c.get("isFinalized") and c.get("priority") == "high"]
        if alta_pes:
            linhas.append(f"👤 *{len(alta_pes)} tarefa(s) pessoal(is) de alta prioridade:*")
            for c in alta_pes[:5]:
                id_curto = (c.get("id") or "")[:8]
                linhas.append(f"  • {c.get('title', 'Tarefa')} | id: {id_curto}")
            linhas.append("")
    except requests.RequestException:
        pass

    # Tarefas diárias de hoje
    try:
        tarefas_hoje = obsidian_service.listar_tarefas_diarias()
        if tarefas_hoje:
            pendentes = [t for t in tarefas_hoje if not t.get("done")]
            concluidas = [t for t in tarefas_hoje if t.get("done")]
            linhas.append(f"📋 *Tarefas de hoje:* {len(pendentes)} pendente(s) / {len(concluidas)} concluída(s)")
            linhas.append("")
    except requests.RequestException:
        pass

    # Ideias recentes (últimos 7 dias)
    try:
        docs = obsidian_service.listar_documentos()
        sete_dias_atras = (datetime.datetime.utcnow() - datetime.timedelta(days=7)).isoformat()[:10]
        recentes = [d for d in docs if (d.get("createdAt") or "")[:10] >= sete_dias_atras]
        if recentes:
            linhas.append(f"💡 *{len(recentes)} ideia(s) registrada(s) nos últimos 7 dias.*")
    except requests.RequestException:
        pass

    if len(linhas) == 1:
        linhas.append("Tudo em dia! Nenhum item urgente no momento.")

    return "\n".join(linhas)


async def handler_briefing(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para /briefing — envia resumo diário sem LLM."""
    if not _verificar_acesso(update):
        return
    texto = await _montar_briefing()
    await update.message.reply_text(texto, parse_mode="Markdown")


# ──────────────────────────── Message handlers ────────────────────────────────

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
    logger.info("Nova mensagem de %s (chat_id=%s): %r", update.effective_user.username, update.effective_chat.id if update.effective_chat else "?", texto)
    try:
        # Verificar pending_action primeiro
        pending = memory.get_pending_action()
        low = texto.lower().strip()
        if pending:
            if low in ("não", "nao", "n", "cancelar"):
                memory.clear_pending_action()
                await update.message.reply_text("Ok — cancelado.")
                return
            elif low in ("sim", "s", "confirmar", "ok"):
                memory.clear_pending_action()
                await _executar_acao_confirmada(pending, update, context)
                return

        if _parece_pergunta_interesses_areas(texto):
            try:
                interesses = obsidian_service.listar_interesses()
                areas = obsidian_service.listar_areas()
                await update.message.reply_text(_formatar_lista_interesses_areas(interesses, areas))
            except requests.RequestException:
                await update.message.reply_text("⚠️ Não consegui carregar interesses/áreas agora (servidor offline).")
            return

        # Detecção local de intenção: consultar planejamento empresarial (sem passar pelo LLM)
        if _parece_consulta_planejamento_empresarial(texto):
            logger.info("Detecção local: consulta de planejamento empresarial")
            try:
                cards = obsidian_service.listar_cards_planejamento()
                if not cards:
                    await update.message.reply_text("❌ Nenhum projeto empresarial criado até o momento.")
                else:
                    await update.message.reply_text(_formatar_cards(cards, "💼", "Planejamento Empresarial"))
            except requests.RequestException as e:
                logger.warning("Erro ao buscar planejamentos empresariais: %s", e)
                await update.message.reply_text("⚠️ Não consegui carregar o planejamento empresarial (servidor offline).")
            return

        # Detecção local de intenção: consultar planejamento pessoal (sem passar pelo LLM)
        if _parece_consulta_planejamento_pessoal(texto):
            logger.info("Detecção local: consulta de planejamento pessoal")
            try:
                cards = obsidian_service.listar_cards_planejamento_pessoal()
                if not cards:
                    await update.message.reply_text("❌ Nenhum projeto pessoal criado até o momento.")
                else:
                    await update.message.reply_text(_formatar_cards(cards, "👤", "Planejamento Pessoal"))
            except requests.RequestException as e:
                logger.warning("Erro ao buscar planejamentos pessoais: %s", e)
                await update.message.reply_text("⚠️ Não consegui carregar o planejamento pessoal (servidor offline).")
            return

        # Detecção local: tarefas diárias
        if _parece_consulta_tarefas_diarias(texto):
            logger.info("Detecção local: consulta de tarefas diárias")
            try:
                tarefas = obsidian_service.listar_tarefas_diarias()
                await update.message.reply_text(_formatar_tarefas_diarias(tarefas))
            except requests.RequestException as e:
                logger.warning("Erro ao buscar tarefas diárias: %s", e)
                await update.message.reply_text("⚠️ Não consegui carregar as tarefas de hoje (servidor offline).")
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

        if _parece_consulta_planejamento_empresarial(texto):
            logger.info("Detecção local (voz): consulta de planejamento empresarial")
            try:
                cards = obsidian_service.listar_cards_planejamento()
                if not cards:
                    await update.message.reply_text("❌ Nenhum projeto empresarial criado até o momento.")
                else:
                    await update.message.reply_text(_formatar_cards(cards, "💼", "Planejamento Empresarial"))
            except requests.RequestException:
                await update.message.reply_text("⚠️ Não consegui carregar o planejamento empresarial.")
            return

        if _parece_consulta_planejamento_pessoal(texto):
            logger.info("Detecção local (voz): consulta de planejamento pessoal")
            try:
                cards = obsidian_service.listar_cards_planejamento_pessoal()
                if not cards:
                    await update.message.reply_text("❌ Nenhum projeto pessoal criado até o momento.")
                else:
                    await update.message.reply_text(_formatar_cards(cards, "👤", "Planejamento Pessoal"))
            except requests.RequestException:
                await update.message.reply_text("⚠️ Não consegui carregar o planejamento pessoal.")
            return

        if _parece_consulta_tarefas_diarias(texto):
            try:
                tarefas = obsidian_service.listar_tarefas_diarias()
                await update.message.reply_text(_formatar_tarefas_diarias(tarefas))
            except requests.RequestException:
                await update.message.reply_text("⚠️ Não consegui carregar as tarefas de hoje.")
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


# ────────────────────────────── Jobs periódicos ───────────────────────────────

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


async def _job_briefing_diario(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Job diário: envia briefing matinal às 08:00 para TELEGRAM_CHAT_ID."""
    chat_id = getattr(config, "TELEGRAM_CHAT_ID", "") or ""
    if not chat_id:
        return
    try:
        texto = await _montar_briefing()
        await context.bot.send_message(chat_id=chat_id, text=texto, parse_mode="Markdown")
    except Exception as e:
        logger.warning("Job briefing diário: %s", e)


# ──────────────────────────────────── main ────────────────────────────────────

def main() -> None:
    """Valida config, monta a aplicação e inicia o polling."""
    config.validar_config()
    key = getattr(config, "OPENROUTER_API_KEY", "") or ""
    logger.info(
        "OPENROUTER_API_KEY definida: %s (len=%d)",
        "sim" if key.strip() else "não",
        len(key),
    )
    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()

    # Slash commands
    app.add_handler(CommandHandler("start", handler_start))
    app.add_handler(CommandHandler("briefing", handler_briefing))
    app.add_handler(CommandHandler("empresarial", handler_empresarial))
    app.add_handler(CommandHandler("pessoal", handler_pessoal))
    app.add_handler(CommandHandler("lembretes", handler_lembretes))
    app.add_handler(CommandHandler("hoje", handler_hoje))
    app.add_handler(CommandHandler("categorias", handler_categorias))

    # Mensagens de texto e voz
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handler_mensagem_texto))
    app.add_handler(MessageHandler(filters.VOICE, handler_mensagem_voz))

    # Jobs periódicos
    if getattr(config, "TELEGRAM_CHAT_ID", "") and config.TELEGRAM_CHAT_ID.strip():
        app.job_queue.run_repeating(_job_lembretes_vencidos, interval=60, first=30)
        import datetime as _dt_jobs
        app.job_queue.run_daily(
            _job_briefing_diario,
            time=_dt_jobs.time(hour=8, minute=0, tzinfo=_dt_jobs.timezone(_dt_jobs.timedelta(hours=-3))),
        )
        logger.info("Jobs ativos: lembretes periódicos + briefing diário às 08:00 (Brasília).")

    logger.info("Bot iniciando...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
