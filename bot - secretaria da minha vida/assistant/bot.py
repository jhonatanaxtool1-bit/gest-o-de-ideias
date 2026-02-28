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
logger = logging.getLogger(__name__)

RESPOSTA_ERRO = "Não foi possível processar agora. Tente mais tarde."

# Palavras que indicam pedido de salvar/guardar ideia (para buscar interesses e áreas)
_PALAVRAS_SALVAR_IDEIA = ("guardar", "salvar", "anotar", "ideia", "nota", "registrar", "gravar")


def _parece_pedido_salvar_ideia(texto: str) -> bool:
    """True se a mensagem parece pedir para salvar/guardar uma ideia."""
    t = texto.lower().strip()
    return any(p in t for p in _PALAVRAS_SALVAR_IDEIA)


def _parece_pergunta_interesses_areas(texto: str) -> bool:
    """True se a mensagem parece pedir a lista de interesses/áreas (categorias)."""
    t = texto.lower().strip()
    if any(k in t for k in ("categoria", "categorias", "categ")):
        return True
    tem_interesse = any(k in t for k in ("interesse", "interesses", "interres", "interreses", "interes"))
    tem_area = any(k in t for k in ("área", "area", "áreas", "areas"))
    return tem_interesse and tem_area


def _formatar_lista_interesses_areas(interesses: list[dict], areas: list[dict]) -> str:
    """Formata: Interesse - Área - Área (uma linha por interesse)."""
    areas_by_interest_id: dict[str, list[str]] = {}
    for a in (areas or []):
        interest_id = a.get("interestId")
        name = (a.get("name") or "").strip()
        if not interest_id or not name:
            continue
        areas_by_interest_id.setdefault(interest_id, []).append(name)

    linhas: list[str] = []
    for i in sorted((interesses or []), key=lambda it: ((it.get("name") or "").strip().lower())):
        interest_name = (i.get("name") or "").strip()
        if not interest_name:
            continue
        a_names = sorted(set(areas_by_interest_id.get(i.get("id"), [])), key=lambda s: s.lower())
        if a_names:
            linhas.append(" - ".join([interest_name, *a_names]))
        else:
            linhas.append(f"{interest_name} - (nenhuma área)")

    if not linhas:
        return "Suas categorias são:\n(sem interesses/áreas cadastrados)"
    return "Suas categorias são:\n" + "\n".join(linhas)


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
            interesses = obsidian_service.listar_interesses()
            areas = obsidian_service.listar_areas()
            interesses_areas = (interesses, areas)
        except requests.RequestException as e:
            logger.warning("Não foi possível carregar interesses/áreas do Obsidian: %s", e)
    resultado = llm.perguntar_llm(texto, contexto_memoria=memoria_dados, interesses_areas=interesses_areas)
    resposta = resultado.get("resposta", "Ok.")
    acao = resultado.get("acao", "responder")
    dados = resultado.get("dados")

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
                if par:
                    interest_final, area_final = par
                    obsidian_service.criar_documento(
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
            status = dados.get("status", "todo")
            priority = dados.get("priority", "medium")
            obsidian_service.criar_card_planejamento(title=title, status=status, priority=priority)
            resposta = f"{resposta}\n\n✅ Tarefa criada no planejamento empresarial."
        else:
            # default: just reply
            pass
    except requests.RequestException as e:
        logger.exception("Erro ao comunicar com Obsidian backend: %s", e)
        resposta = f"{resposta}\n\n⚠️ Não foi possível gravar no Obsidian (verifique servidor)."
    await update.message.reply_text(resposta)


async def handler_mensagem_texto(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para mensagens de texto."""
    if not update.message or not update.message.text:
        return
    texto = update.message.text.strip()
    if not texto:
        return
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
    except Exception as e:
        logger.exception("Erro ao processar mensagem de texto: %s", e)
        await update.message.reply_text(RESPOSTA_ERRO)


async def handler_mensagem_voz(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler para mensagens de áudio (voice)."""
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
        await _processar_texto_e_responder(texto.strip(), update, context)
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
    logger.info("Bot iniciando...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
