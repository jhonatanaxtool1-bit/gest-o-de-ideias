"""
Integração com LLM via OpenRouter (API REST).
Função genérica perguntar_llm retorna dict com titulo, tipo, resumo, tags.
"""
import json
import logging
import re

import requests

from assistant.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    OPENROUTER_MODEL,
    OPENROUTER_TIMEOUT,
)

logger = logging.getLogger(__name__)

PROMPT_SISTEMA = """Você é a secretária pessoal do usuário: organiza ideias e pensamentos no Second Brain (Obsidian) e no planejamento. Seja extremamente inteligente ao interpretar as intenções do usuário e verifique cuidadosamente os dados antes de sugerir uma ação.

⚠️ REGRAS CRÍTICAS DE INTERPRETAÇÃO (LEIA ANTES DE TUDO):
1. Se o usuário PERGUNTAR sobre tarefas/projetos empresariais ("quais são", "o que tenho", "me mostre", "liste", "ver", "tenho registrado", "cadastrado"): use OBRIGATORIAMENTE acao="listar_planejamentos_empresariais".
2. Se o usuário PERGUNTAR sobre tarefas/projetos pessoais ("quais são", "o que tenho", "me mostre", "liste", "ver", "tenho registrado"): use OBRIGATORIAMENTE acao="listar_planejamentos_pessoais".
3. Só use "criar_tarefa_planejamento" ou "criar_tarefa_planejamento_pessoal" quando o usuário EXPLICITAMENTE pedir para CRIAR/ADICIONAR uma nova tarefa.
4. Perguntas com "quais", "o que tenho", "me mostre", "liste" = SEMPRE listar, NUNCA criar.
5. Nunca confunda CONSULTAR com CRIAR. Consultar = listar_planejamentos_*. Criar = criar_tarefa_planejamento_*.
6. IDEIA vs LEMBRETE: Se o usuário disser "registre", "anote", "salve", "guarde", "anotar", "salvar" + mencionar uma área/interesse (ex: "registre na área X que eu preciso fazer Y"): é SEMPRE uma IDEIA (acao="salvar_ideia"). NUNCA crie um lembrete nesse caso, mesmo que o texto contenha "preciso" ou "tenho que".
7. LEMBRETE só deve ser criado quando o usuário usar EXPLICITAMENTE: "me lembre", "lembre-me", "crie um lembrete", "lembrete de", "me avise", "me notifique". Sem essas palavras, NÃO crie lembrete.

Hierarquia obrigatória (nunca confunda):
- INTERESSE = categoria pai (nível superior). Ex.: "Leitura", "Naxtool", "Pessoal".
- ÁREA = subcategoria que pertence a um único interesse. Ex.: "Geral", "Inbox", "Ideias".
- Ao falar de "categorias", "organização" ou "onde classificar": sempre separe em (1) Interesses e (2) Áreas, deixando claro qual área pertence a qual interesse.

Identidade e funções (use quando perguntarem "quais são suas funções", "o que você faz", "quais são as funções do minha gente", etc.):
- Quem você é: secretária pessoal que ajuda a organizar a vida digital e os pensamentos.
- O que você faz: (1) Salvar, consultar e editar ideias no Second Brain, classificando por interesse e área; (2) Criar, consultar e editar lembretes (uma vez, diário, a cada 2 dias, semanal); (3) Criar, consultar e editar tarefas no planejamento empresarial; (4) Criar, consultar e editar tarefas no planejamento pessoal; (5) Consultar categorias existentes; (6) Responder de forma direta, inteligente e cordial.
- Para perguntas sobre suas funções, use EXATAMENTE o texto abaixo no campo "resposta" (preserve quebras de linha com \\n). O link do Obsidian Premium é enviado automaticamente ao usuário nesses casos; não inclua URL na resposta.
"Sou sua secretária pessoal.\\nMinhas funções incluem salvar e organizar suas ideias no Second Brain, para que você tenha mais clareza e organização.\\n\\nResponsabilidades:\\n- Organizar, consultar e editar suas ideias e documentos (por interesse > área).\\n- Criar, consultar e editar lembretes (uma vez, diário, a cada 2 dias, semanal) e lançar lembretes vencidos.\\n- Criar, consultar e editar planejamentos empresariais e pessoais.\\n- Informar sobre seus planejamentos atuais, lembretes, categorias, ou os dados de alguma ideia que você buscou."

Sua resposta deve ser SEMPRE e APENAS um único objeto JSON válido, sem texto antes ou depois.

Regra: nunca escreva texto livre. Só retorne o JSON. Analise a intenção do usuário com cuidado. Se o usuário quiser "lançar" algo, use a ação de "criar". Se quiser "consultar", use a ação de "listar" ou "buscar". Se quiser "editar", use a ação de "atualizar".

Formato obrigatório:
{"resposta": "sua mensagem curta aqui", "acao": "responder|salvar_ideia|criar_tarefa_planejamento|criar_tarefa_planejamento_pessoal|atualizar_ideia|criar_lembrete|lançar_lembretes|listar_planejamentos_empresariais|listar_planejamentos_pessoais|listar_lembretes_ativos|listar_categorias|buscar_ideia|atualizar_planejamento|atualizar_planejamento_pessoal|atualizar_lembrete|excluir_ideia|excluir_tarefa_empresarial|excluir_tarefa_pessoal|excluir_lembrete|criar_tarefa_diaria|concluir_tarefa_diaria|listar_tarefas_diarias", "dados": {}}

- resposta: mensagem breve, inteligente e cordial (sempre preencha).
- acao: "responder" para conversa livre; "salvar_ideia" para guardar ideia; "criar_tarefa_planejamento" ou "criar_tarefa_planejamento_pessoal" APENAS para CRIAR uma tarefa nova; "atualizar_ideia", "criar_lembrete", "atualizar_planejamento", "atualizar_planejamento_pessoal", "atualizar_lembrete" para alterar ou criar entidades; "lançar_lembretes" para ver vencidos; e use os seguintes para CONSULTAR/LISTAR: "listar_planejamentos_empresariais" (consultar tarefas empresariais existentes), "listar_planejamentos_pessoais" (consultar tarefas pessoais existentes), "listar_lembretes_ativos", "listar_categorias", e "buscar_ideia" para buscar dados específicos. Para EXCLUIR use: "excluir_ideia", "excluir_tarefa_empresarial", "excluir_tarefa_pessoal", "excluir_lembrete". Para TAREFAS DIÁRIAS: "criar_tarefa_diaria", "concluir_tarefa_diaria", "listar_tarefas_diarias".
- dados: só quando acao não for "responder". Exemplos:
  - salvar_ideia: {"titulo": "...", "resumo": "...", "tags": [], "interest": "nome do interesse", "area": "nome da área"}
  - criar_tarefa_planejamento, atualizar_planejamento: {"id": "uuid se atualizar", "titulo": "...", "status": "todo", "priority": "medium", "isFinalized": false}
  - criar_tarefa_planejamento_pessoal, atualizar_planejamento_pessoal: {"id": "uuid se atualizar", "titulo": "...", "status": "todo", "priority": "medium", "isFinalized": false}
  - atualizar_ideia: {"id": "uuid da ideia", "titulo": "opcional", "resumo": "opcional", "interest": "opcional", "area": "opcional", "tags": "opcional"}
  - criar_lembrete, atualizar_lembrete: {"id": "uuid se atualizar", "titulo": "...", "body": "opcional", "firstDueAt": "ISO 8601 SEMPRE com offset de Brasilia (UTC-3), ex: '2026-03-04T23:55:00-03:00'. NUNCA use Z nem omita o offset.", "recurrence": "once|daily|every_2_days|weekly"}
  - lançar_lembretes, listar_planejamentos_empresariais, listar_planejamentos_pessoais, listar_lembretes_ativos, listar_categorias, listar_tarefas_diarias: dados vazio {}
  - buscar_ideia: {"termo": "trecho do título", "interest": "opcional", "area": "opcional", "tag": "opcional"}
  - excluir_ideia: {"id": "uuid da ideia", "titulo": "título para confirmação"}
  - excluir_tarefa_empresarial: {"id": "uuid do card", "titulo": "título para confirmação"}
  - excluir_tarefa_pessoal: {"id": "uuid do card", "titulo": "título para confirmação"}
  - excluir_lembrete: {"id": "uuid do lembrete", "titulo": "título para confirmação"}
  - criar_tarefa_diaria: {"titulo": "..."}
  - concluir_tarefa_diaria: {"id": "uuid da tarefa diária"}

Regra OBRIGATÓRIA ao salvar ideia (acao salvar_ideia):
1) Primeiro escolha um INTERESSE da lista que faça sentido para a ideia. PREFIRA SEMPRE um interesse já existente na lista.
2) Depois escolha uma ÁREA que pertença a esse interesse.
3) SEMPRE preencha "interest" e "area" em dados. Use APENAS interesses e áreas que existam na lista.
4) Se o usuário disser "anotar em X > Y" ou "salvar em X > Y": verifique na lista de INTERESSES existentes.

Exemplos de CONSULTAS (sempre listar, nunca criar):
Exemplo "quais são minhas tarefas empresariais": {"resposta": "Buscando planejamentos empresariais...", "acao": "listar_planejamentos_empresariais", "dados": {}}
Exemplo "o que tenho no planejamento empresarial": {"resposta": "Buscando planejamentos empresariais...", "acao": "listar_planejamentos_empresariais", "dados": {}}
Exemplo "me mostre os projetos empresariais cadastrados": {"resposta": "Buscando planejamentos empresariais...", "acao": "listar_planejamentos_empresariais", "dados": {}}
Exemplo "quais são os meus planejamentos pessoais": {"resposta": "Buscando planejamentos pessoais...", "acao": "listar_planejamentos_pessoais", "dados": {}}
Exemplo "o que tenho no planejamento pessoal": {"resposta": "Buscando planejamentos pessoais...", "acao": "listar_planejamentos_pessoais", "dados": {}}
Exemplo "quais são as categorias existentes": {"resposta": "Verificando suas categorias...", "acao": "listar_categorias", "dados": {}}
Exemplo para listar lembretes existentes: {"resposta": "Buscando lembretes.", "acao": "listar_lembretes_ativos", "dados": {}}

Exemplos de CRIAÇÕES:
Exemplo para um "oi": {"resposta": "Oi! Em que posso ajudar?", "acao": "responder", "dados": null}
Exemplo para guardar ideia genérica: {"resposta": "Anotado em Pessoal > Inbox.", "acao": "salvar_ideia", "dados": {"titulo": "Título", "resumo": "Texto", "tags": [], "interest": "Pessoal", "area": "Inbox"}}
Exemplo para "registre na area instagram que preciso lançar um vídeo": {"resposta": "Ideia registrada.", "acao": "salvar_ideia", "dados": {"titulo": "Lançar vídeo", "resumo": "Preciso lançar um vídeo", "tags": [], "interest": "Redes Sociais", "area": "Instagram"}}
Exemplo para "salve na area naxtool que tenho que terminar o app": {"resposta": "Ideia salva.", "acao": "salvar_ideia", "dados": {"titulo": "Terminar o app", "resumo": "Tenho que terminar o app", "tags": [], "interest": "Naxtool", "area": "Sistemas"}}
Exemplo para criar LEMBRETE (so com palavras explicitas): {"resposta": "Lembrete criado.", "acao": "criar_lembrete", "dados": {"titulo": "Comprar presente", "firstDueAt": "2024-01-01T10:00:00-03:00", "recurrence": "once"}}
Exemplo para tarefa no planejamento pessoal: {"resposta": "Tarefa adicionada.", "acao": "criar_tarefa_planejamento_pessoal", "dados": {"titulo": "Comprar presente", "status": "todo", "priority": "medium"}}
Exemplo para editar planejamento: {"resposta": "Atualizando tarefa.", "acao": "atualizar_planejamento", "dados": {"id": "uuid", "priority": "high"}}
Exemplo para editar lembrete: {"resposta": "Lembrete alterado.", "acao": "atualizar_lembrete", "dados": {"id": "uuid", "titulo": "Novo título"}}
Exemplo quando pede "quais meus lembretes pendentes", "me avise dos lembretes": {"resposta": "Verificando lembretes vencidos.", "acao": "lançar_lembretes", "dados": {}}
Exemplo para excluir ideia: {"resposta": "Vou excluir essa ideia.", "acao": "excluir_ideia", "dados": {"id": "uuid", "titulo": "Título da ideia"}}
Exemplo para excluir tarefa empresarial: {"resposta": "Vou excluir essa tarefa.", "acao": "excluir_tarefa_empresarial", "dados": {"id": "uuid", "titulo": "Título da tarefa"}}
Exemplo para excluir tarefa pessoal: {"resposta": "Vou excluir essa tarefa.", "acao": "excluir_tarefa_pessoal", "dados": {"id": "uuid", "titulo": "Título da tarefa"}}
Exemplo para excluir lembrete: {"resposta": "Vou excluir esse lembrete.", "acao": "excluir_lembrete", "dados": {"id": "uuid", "titulo": "Título do lembrete"}}
Exemplo para criar tarefa diária: {"resposta": "Tarefa de hoje adicionada.", "acao": "criar_tarefa_diaria", "dados": {"titulo": "Revisar e-mails"}}
Exemplo para listar tarefas de hoje: {"resposta": "Suas tarefas de hoje:", "acao": "listar_tarefas_diarias", "dados": {}}
Exemplo para concluir tarefa diária: {"resposta": "Tarefa marcada como concluída.", "acao": "concluir_tarefa_diaria", "dados": {"id": "uuid"}}"""
# Prompt separado para refino antes de salvar.
PROMPT_REFINO_IDEIA = """Você vai refinar um texto de ideia ANTES de ser salvo.

Regras:
- Corrija erros gramaticais, de concordância, ortografia e pontuação (pt-BR), sem mudar o significado.
- Gere uma descrição curta (1–2 frases) em "descricao" com o essencial.
- Não invente fatos nem adicione informações novas.
- Mantenha termos técnicos, nomes próprios e siglas.

Retorne SOMENTE um JSON válido no formato:
{"titulo": "...", "descricao": "...", "corpo": "..."}

- titulo: título curto e claro (até 80 caracteres). Se o título original já estiver bom, mantenha; senão corrija.
- descricao: 1–2 frases.
- corpo: versão corrigida do texto (pode ser igual ao original, apenas corrigido).
"""

# Correção de título e resumo antes de inserir tarefa ou lembrete (só gramática/concordância).
PROMPT_CORRIGIR_TITULO_RESUMO = """Você vai corrigir texto ANTES de ser salvo como título ou resumo (tarefa, lembrete).

Regras:
- Corrija APENAS erros gramaticais, de concordância, ortografia e pontuação (pt-BR).
- Não mude o significado nem adicione informações.
- Mantenha termos técnicos, nomes próprios e siglas.
- Se o texto já estiver correto, devolva igual.

Retorne SOMENTE um JSON válido:
{"titulo": "...", "resumo": "..."}

- titulo: versão corrigida do título (obrigatório).
- resumo: versão corrigida do resumo/descrição; se não houver resumo, use string vazia "".
"""

# Fallback quando o parse do JSON falha
FALLBACK_DADOS = {
    "titulo": "",
    "resumo": "",
    "tags": [],
}


def _formatar_contexto_memoria(contexto: dict) -> str:
    """Reduz memória a uma string para não estourar limite de tokens."""
    if not contexto:
        return ""
    partes = []
    if "usuario" in contexto:
        u = contexto["usuario"]
        partes.append(f"Perfil: {u.get('perfil', '')}")
        if u.get("interesses"):
            partes.append(f"Interesses: {', '.join(u['interesses'])}")
    if "contexto_recente" in contexto:
        ctx = contexto["contexto_recente"]
        ui = ctx.get("ultima_ideia", {})
        if ui.get("interesse") and ui.get("area"):
            partes.append(f"Última área usada: {ui['interesse']} > {ui['area']}")
        cats = ctx.get("categorias_frequentes", {})
        if cats:
            top = sorted(cats.items(), key=lambda x: -x[1])[:2]
            partes.append(f"Categorias frequentes: {', '.join(k for k, _ in top)}")
    return " | ".join(partes) if partes else ""


def _reparar_json_trailing_comma(raw: str) -> str:
    """
    Corrige JSON com vírgula faltando entre propriedades (erro comum de LLMs).
    Ex.: "resposta": "texto"\n  "arquivar": false -> insere vírgula após o valor.
    """
    # Valor string terminando com " (não escapada) seguido de \n e nova chave "
    raw = re.sub(r'(?<!\\)"\s*\n(\s*")', r'",\n\1', raw)
    # Valor número ou keyword (true/false/null) seguido de \n e nova chave "
    raw = re.sub(r'(\d|true|false|null)\s*\n(\s*")', r'\1,\n\2', raw)
    return raw


def _extrair_json(texto: str) -> dict | None:
    """
    Tenta extrair um objeto JSON do texto (pode vir com markdown ou texto ao redor).
    Aplica reparo de vírgulas faltando antes de fazer parse.
    """
    texto = texto.strip()
    # Remove blocos de código markdown
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", texto)
    if match:
        texto = match.group(1).strip()
    # Tenta encontrar {...}
    match = re.search(r"\{[\s\S]*\}", texto)
    if match:
        raw = match.group(0)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            try:
                return json.loads(_reparar_json_trailing_comma(raw))
            except json.JSONDecodeError:
                pass
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        try:
            return json.loads(_reparar_json_trailing_comma(texto))
        except json.JSONDecodeError:
            return None


TIPOS_PERMITIDOS = ("ideia", "tarefa", "projeto", "lembrete")


def _normalizar_resposta(dados: dict) -> dict:
    """Normaliza a saída em: resposta, acao, dados."""
    if isinstance(dados, list):
        dados = dados[0] if dados else {}
    if not isinstance(dados, dict):
        return {"resposta": str(dados)[:500] or "Ok.", "acao": "responder", "dados": None}

    resposta = str(dados.get("resposta", "")).strip() or "Ok."
    # Backwards-compatibilidade: suportar chave 'arquivar'
    arquivar = bool(dados.get("arquivar", False))
    acao = str(dados.get("acao", "")) or ("salvar_ideia" if arquivar else "responder")

    payload: dict | None = None
    if acao == "salvar_ideia" or arquivar:
        # LLM pode enviar titulo/resumo no objeto aninhado "dados" ou na raiz
        inner = dados.get("dados") if isinstance(dados.get("dados"), dict) else {}
        titulo = str(inner.get("titulo") or dados.get("titulo") or "")[:255].strip() or "Sem título"
        resumo = str(inner.get("resumo") or dados.get("resumo") or "").strip()
        tags = inner.get("tags") if isinstance(inner.get("tags"), list) else dados.get("tags")
        tags = list(tags) if isinstance(tags, list) else []
        interest = str(inner.get("interest") or dados.get("interest") or "").strip()
        area = str(inner.get("area") or dados.get("area") or "").strip()
        payload = {
            "titulo": titulo,
            "resumo": resumo,
            "tags": tags,
            "interest": interest,
            "area": area,
        }
    else:
        payload = dados.get("dados") if isinstance(dados.get("dados"), dict) else None

    return {"resposta": resposta, "acao": acao, "dados": payload}


def _formatar_interesses_areas(interesses: list, areas: list) -> str:
    """Monta texto da hierarquia INTERESSE (pai) → ÁREAS (filhas) para o prompt."""
    if not interesses and not areas:
        return ""
    lines = []
    for i in (interesses or []):
        nomes_areas = [a["name"] for a in (areas or []) if a.get("interestId") == i["id"]]
        lines.append(f"- INTERESSE «{i['name']}» → ÁREAS: {', '.join(nomes_areas) if nomes_areas else '(nenhuma)'}")
    return (
        "INTERESSES (categoria pai) e ÁREAS (subcategoria, cada uma pertence a um interesse):\n"
        + "\n".join(lines)
        + "\nAo responder sobre categorias existentes, liste sempre primeiro os INTERESSES, depois as ÁREAS agrupadas por interesse."
    )


PROMPT_ESCOLHER_PAR_FALLBACK = """O usuário quer salvar uma ideia, mas o par (interesse, área) que foi sugerido não existe na lista cadastrada.

Sua tarefa: escolher exatamente UM interesse e UMA área da lista abaixo que façam mais sentido para classificar essa ideia.

Regras:
- Retorne SOMENTE um JSON válido: {"interest": "nome exato do interesse", "area": "nome exato da área"}
- Use APENAS nomes que aparecem na lista (interesse exatamente como em «...», área exatamente como na lista).
- A área escolhida DEVE pertencer ao interesse escolhido (cada área está listada sob um único interesse).
- Não invente nem altere nomes."""


def escolher_par_interesse_area_fallback(
    titulo: str,
    texto_ideia: str,
    interest_sugerido: str,
    area_sugerida: str,
    interesses: list,
    areas: list,
) -> dict | None:
    """
    Quando a busca por (interesse, área) falhou, pergunta à LLM qual par da lista
    real faz mais sentido para a ideia. Retorna {"interest": str, "area": str} ou None.
    """
    if not interesses and not areas:
        return None
    hierarquia = _formatar_interesses_areas(interesses, areas)
    if not hierarquia:
        return None

    user = (
        f"LISTA DE INTERESSES E ÁREAS (use apenas estes nomes):\n{hierarquia}\n\n"
        f"Par que foi sugerido (não encontrado): interesse={interest_sugerido!r}, área={area_sugerida!r}\n\n"
        f"IDEIA A CLASSIFICAR:\nTítulo: {titulo}\n\nTexto: {(texto_ideia or '')[:800]}\n\n"
        "Retorne apenas o JSON com interest e area (nomes exatos da lista)."
    )
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": PROMPT_ESCOLHER_PAR_FALLBACK},
            {"role": "user", "content": user},
        ],
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            OPENROUTER_BASE_URL,
            json=payload,
            headers=headers,
            timeout=OPENROUTER_TIMEOUT,
        )
        resp.raise_for_status()
        body = resp.json()
    except requests.RequestException as e:
        logger.warning("Falha ao pedir par interesse/área (fallback): %s", e)
        return None
    except json.JSONDecodeError:
        return None

    choices = body.get("choices") or []
    if not choices:
        return None

    content = (choices[0].get("message") or {}).get("content") or ""
    parsed = _extrair_json(content)
    if not isinstance(parsed, dict):
        return None

    interest = str(parsed.get("interest") or "").strip()
    area = str(parsed.get("area") or "").strip()
    if not interest or not area:
        return None

    return {"interest": interest, "area": area}


def refinar_ideia(titulo: str, corpo: str) -> dict | None:
    """
    Refina título/corpo e gera uma descrição curta antes de salvar.
    Retorna {"titulo": str, "descricao": str, "corpo": str} ou None se falhar.
    """
    titulo = (titulo or "").strip()
    corpo = (corpo or "").strip()
    if not corpo and not titulo:
        return None

    user = f"TÍTULO ORIGINAL:\n{titulo}\n\nTEXTO ORIGINAL:\n{corpo}"
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": PROMPT_REFINO_IDEIA},
            {"role": "user", "content": user},
        ],
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            OPENROUTER_BASE_URL,
            json=payload,
            headers=headers,
            timeout=OPENROUTER_TIMEOUT,
        )
        resp.raise_for_status()
        body = resp.json()
    except requests.RequestException as e:
        logger.warning("Falha ao refinar ideia (request): %s", e)
        return None
    except json.JSONDecodeError as e:
        logger.warning("Falha ao refinar ideia (json): %s", e)
        return None

    choices = body.get("choices") or []
    if not choices:
        return None

    content = (choices[0].get("message") or {}).get("content") or ""
    parsed = _extrair_json(content)
    if not isinstance(parsed, dict):
        return None

    out_titulo = str(parsed.get("titulo") or titulo or "Sem título").strip()[:255] or "Sem título"
    out_descricao = str(parsed.get("descricao") or "").strip()
    out_corpo = str(parsed.get("corpo") or corpo or "").strip()

    if not out_descricao:
        return None
    if not out_corpo:
        out_corpo = corpo

    return {"titulo": out_titulo, "descricao": out_descricao, "corpo": out_corpo}


def corrigir_titulo_resumo(titulo: str, resumo: str | None = None) -> dict | None:
    """
    Corrige título e opcionalmente resumo (gramática, concordância, ortografia) antes de inserir
    lista, tarefa ou lembrete. Retorna {"titulo": str, "resumo": str} ou None se falhar.
    """
    titulo = (titulo or "").strip()
    resumo = (resumo or "").strip()
    if not titulo and not resumo:
        return None

    user = f"TÍTULO:\n{titulo or '(vazio)'}\n\n"
    if resumo:
        user += f"RESUMO/DESCRIÇÃO:\n{resumo}"
    else:
        user += "RESUMO/DESCRIÇÃO: (vazio)"

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": PROMPT_CORRIGIR_TITULO_RESUMO},
            {"role": "user", "content": user},
        ],
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            OPENROUTER_BASE_URL,
            json=payload,
            headers=headers,
            timeout=OPENROUTER_TIMEOUT,
        )
        resp.raise_for_status()
        body = resp.json()
    except requests.RequestException as e:
        logger.warning("Falha ao corrigir título/resumo (request): %s", e)
        return None
    except json.JSONDecodeError as e:
        logger.warning("Falha ao corrigir título/resumo (json): %s", e)
        return None

    choices = body.get("choices") or []
    if not choices:
        return None

    content = (choices[0].get("message") or {}).get("content") or ""
    parsed = _extrair_json(content)
    if not isinstance(parsed, dict):
        return None

    out_titulo = str(parsed.get("titulo") or titulo or "").strip() or titulo
    out_resumo = str(parsed.get("resumo") or resumo or "").strip() if resumo else ""

    return {"titulo": out_titulo, "resumo": out_resumo}


def perguntar_llm(
    texto: str,
    contexto_memoria: dict | None = None,
    interesses_areas: tuple[list, list] | None = None,
) -> dict:
    """
    Envia o texto para a LLM via OpenRouter e retorna dict com resposta, acao, dados.
    interesses_areas: (listar_interesses(), listar_areas()) para incluir hierarquia no prompt.
    """
    system = PROMPT_SISTEMA
    contexto_str = _formatar_contexto_memoria(contexto_memoria or {})
    if contexto_str:
        system += f"\n\nContexto do usuário: {contexto_str}"
    if interesses_areas:
        interesses, areas = interesses_areas
        hierarquia = _formatar_interesses_areas(interesses, areas)
        if hierarquia:
            system += f"\n\n{hierarquia}\nUse APENAS nomes de interesse e área que existam acima. Não crie nem sugira novos interesses ou áreas."

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": texto},
        ],
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            OPENROUTER_BASE_URL,
            json=payload,
            headers=headers,
            timeout=OPENROUTER_TIMEOUT,
        )
        resp.raise_for_status()
        body = resp.json()
    except requests.RequestException as e:
        logger.error("Erro na requisição OpenRouter: %s", e)
        raise
    except json.JSONDecodeError as e:
        logger.error("Resposta OpenRouter não é JSON: %s", e)
        raise

    choices = body.get("choices") or []
    if not choices:
        logger.warning("OpenRouter retornou sem choices; usando fallback")
        return _normalizar_resposta({"resposta": "Recebi sua mensagem.", "arquivar": False})

    content = (choices[0].get("message") or {}).get("content") or ""
    parsed = _extrair_json(content)
    if parsed is None:
        logger.warning("Resposta da LLM não é JSON válido. Raw: %s", content[:500])
        # Usa o texto que a LLM devolveu em vez de mensagem fixa
        resposta_bruta = (content or "").strip()[:400] or "Recebi sua mensagem."
        return _normalizar_resposta({"resposta": resposta_bruta, "arquivar": False})

    if isinstance(parsed, list):
        parsed = parsed[0] if parsed else {}
    
    logger.info("JSON extraído da LLM: %s", json.dumps(parsed, ensure_ascii=False))
    return _normalizar_resposta(parsed)
