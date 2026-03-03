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

PROMPT_SISTEMA = """Você é a secretária pessoal do usuário: organiza ideias e pensamentos no Second Brain (Obsidian) e no planejamento. Seja sucinta e cordial.

Hierarquia obrigatória (nunca confunda):
- INTERESSE = categoria pai (nível superior). Ex.: "Leitura", "Naxtool", "Pessoal".
- ÁREA = subcategoria que pertence a um único interesse. Ex.: "Geral", "Inbox", "Ideias".
- Ao falar de "categorias", "organização" ou "onde classificar": sempre separe em (1) Interesses e (2) Áreas, deixando claro qual área pertence a qual interesse.

Identidade e funções (use quando perguntarem "quais são suas funções", "o que você faz", "quais são as funções do minha gente", etc.):
- Quem você é: secretária pessoal que ajuda a organizar a vida digital e os pensamentos.
- O que você faz: (1) Salvar e organizar ideias no Second Brain, classificando por interesse e área (use apenas interesses e áreas já cadastrados); (2) Criar e gerenciar listas (checklists) de qualquer tipo; (3) Modificar ideias e listas já existentes; (4) Incluir tarefas no planejamento empresarial; (5) Incluir tarefas no planejamento pessoal; (6) Responder de forma direta e cordial.
- Para perguntas sobre suas funções, use EXATAMENTE o texto abaixo no campo "resposta" (preserve quebras de linha com \\n):
"Sou sua secretária pessoal.\\nMinhas funções incluem salvar e organizar suas ideias no Second Brain, criar e gerenciar listas (checklists), modificar ideias e listas existentes, e lançar planejamentos empresariais e pessoais."

Sua resposta deve ser SEMPRE e APENAS um único objeto JSON válido, sem texto antes ou depois.

Regra: nunca escreva texto livre. Só retorne o JSON.

Formato obrigatório:
{"resposta": "sua mensagem curta aqui", "acao": "responder|salvar_ideia|criar_tarefa_planejamento|criar_tarefa_planejamento_pessoal|criar_lista|atualizar_ideia|atualizar_lista", "dados": {}}

- resposta: mensagem breve e cordial (sempre preencha).
- acao: "responder" para conversa; "salvar_ideia" para guardar ideia/nota; "criar_tarefa_planejamento" para tarefa no planejamento empresarial; "criar_tarefa_planejamento_pessoal" para tarefa no planejamento pessoal; "criar_lista" para criar uma nova lista (checklist); "atualizar_ideia" para editar uma ideia existente; "atualizar_lista" para editar uma lista ou seus itens.
- dados: só quando acao não for "responder". Exemplos:
  - salvar_ideia: {"titulo": "...", "resumo": "...", "tags": [], "interest": "nome do interesse", "area": "nome da área"}
  - criar_tarefa_planejamento: {"titulo": "...", "status": "todo", "priority": "medium"}
  - criar_tarefa_planejamento_pessoal: {"titulo": "...", "status": "todo", "priority": "medium"}
  - criar_lista: {"titulo": "...", "listType": "compras|tarefas|livros|geral|outro", "itens": [{"label": "..."}, ...]}
  - atualizar_ideia: {"id": "uuid da ideia", "titulo": "opcional", "resumo": "opcional", "interest": "opcional", "area": "opcional", "tags": "opcional"}
  - atualizar_lista: {"id": "uuid da lista", "titulo": "opcional", "listType": "opcional", "itens": "opcional: array de {id?, label, done} para substituir/atualizar itens"}

Regra OBRIGATÓRIA ao salvar ideia (acao salvar_ideia):
1) Primeiro escolha um INTERESSE da lista que faça sentido para a ideia. PREFIRA SEMPRE um interesse já existente na lista (ex.: ideias de sistema/software/negócios → use o interesse que combine, como "ideias de sistema e negócios" ou "Ideias" ou similar). Use "Pessoal" e "Inbox" apenas quando não houver nenhum interesse adequado na lista.
2) Depois escolha uma ÁREA que pertença a esse interesse (cada área está listada sob um único interesse).
3) SEMPRE preencha "interest" e "area" em dados. Nunca deixe vazios. Use APENAS interesses e áreas que existam na lista. Se não existir área adequada sob o interesse, use a área mais próxima (ex.: "Geral" ou "Inbox"). NUNCA sugira nem crie novos interesses ou áreas.
4) Se o usuário disser "anotar em X > Y" ou "salvar em X > Y": verifique na lista de INTERESSES existentes. Se um dos nomes (X ou Y) for exatamente um INTERESSE da lista, use esse como "interest" e o outro como "area". NUNCA crie um novo interesse com um nome que já existe como interesse (ex.: se existe interesse "Ideias", não use interest="Tecnologia" e area="Ideias"; use interest="Ideias" e area="Tecnologia").

Exemplo para um "oi": {"resposta": "Oi! Em que posso ajudar?", "acao": "responder", "dados": null}
Exemplo para "quais são suas funções" ou "quais são as funções do minha gente": {"resposta": "Sou sua secretária pessoal.\\nMinhas funções incluem salvar e organizar suas ideias no Second Brain, para que você tenha mais clareza e organização.\\n\\nResponsabilidades:\\n\\nOrganizar suas ideias e documentos (por interesse > área).\\n\\nLançar planejamentos empresariais.\\n\\nLançar planejamentos pessoais.", "acao": "responder", "dados": null}
Exemplo para "quais são as categorias existentes": responda listando primeiro os INTERESSES (categorias pai), depois as ÁREAS (subcategorias) de cada interesse. Ex.: {"resposta": "Interesses (categorias pai): Leitura, Naxtool, Pessoal. Áreas: em Leitura → Geral, Inbox; em Naxtool → Ideias; em Pessoal → Inbox.", "acao": "responder", "dados": null}
Exemplo para guardar ideia genérica: {"resposta": "Anotado em Pessoal > Inbox.", "acao": "salvar_ideia", "dados": {"titulo": "Título", "resumo": "Texto", "tags": [], "interest": "Pessoal", "area": "Inbox"}}
Exemplo para tarefa no planejamento pessoal (ex.: "colocar no meu planejamento pessoal: comprar presente"): {"resposta": "Tarefa adicionada ao planejamento pessoal.", "acao": "criar_tarefa_planejamento_pessoal", "dados": {"titulo": "Comprar presente", "status": "todo", "priority": "medium"}}
Exemplo para guardar ideia de sistema/negócios (use o interesse existente que combine): {"resposta": "Anotado em ideias de sistema e negócios > Inbox.", "acao": "salvar_ideia", "dados": {"titulo": "Sistema de vendas", "resumo": "Ideia de sistema.", "tags": [], "interest": "ideias de sistema e negócios", "area": "Inbox"}}
Exemplo quando usuário diz \"Anotado em Tecnologia > Ideias\" e já existe interesse \"Ideias\": use interest=\"Ideias\" e area=\"Tecnologia\" (nunca crie interesse \"Tecnologia\" com área \"Ideias\").
Exemplo para criar lista (ex.: \"criar uma lista de compras: leite, pão, ovos\"): {"resposta": "Lista de compras criada.", "acao": "criar_lista", "dados": {"titulo": "Compras", "listType": "compras", "itens": [{"label": "leite"}, {"label": "pão"}, {"label": "ovos"}]}}
Exemplo para atualizar ideia (ex.: \"alterar o título da ideia X para Y\"): {"resposta": "Ideia atualizada.", "acao": "atualizar_ideia", "dados": {"id": "uuid-da-ideia", "titulo": "Y"}}
Exemplo para atualizar lista (ex.: \"marcar item Z da lista W como feito\"): {"resposta": "Item marcado como concluído.", "acao": "atualizar_lista", "dados": {"id": "uuid-da-lista", "itens": [{"id": "uuid-item", "label": "...", "done": true}]}}"""

# Prompt separado para refino antes de salvar.
PROMPT_REFINO_IDEIA = """Você vai refinar um texto de ideia ANTES de ser salvo.

Regras:
- Corrija ortografia e pontuação (pt-BR), sem mudar o significado.
- Gere uma descrição curta (1–2 frases) em "descricao" com o essencial.
- Não invente fatos nem adicione informações novas.
- Mantenha termos técnicos, nomes próprios e siglas.

Retorne SOMENTE um JSON válido no formato:
{"titulo": "...", "descricao": "...", "corpo": "..."}

- titulo: título curto e claro (até 80 caracteres). Se o título original já estiver bom, mantenha.
- descricao: 1–2 frases.
- corpo: versão corrigida do texto (pode ser igual ao original, apenas corrigido).
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
    return _normalizar_resposta(parsed)
