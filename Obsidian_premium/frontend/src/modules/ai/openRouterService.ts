const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_FREE_MODEL = 'mistralai/mistral-7b-instruct:free'

export interface RewriteWithAiInput {
  content: string
  instruction: string
}

interface OpenRouterMessage {
  role: 'system' | 'user'
  content: string
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

function getApiKey(): string {
  return (import.meta.env.VITE_OPENROUTER_API_KEY || '').trim()
}

function getModel(): string {
  return (import.meta.env.VITE_OPENROUTER_MODEL || DEFAULT_FREE_MODEL).trim()
}

function buildMessages(input: RewriteWithAiInput): OpenRouterMessage[] {
  return [
    {
      role: 'system',
      content:
        'Voce e um editor tecnico. Reescreva o texto mantendo o formato existente. ' +
        'Preserve ao maximo: quebras de linha, estrutura de paragrafos, headings em cada linha e links no formato [[...]]. ' +
        'Nao adicione explicacoes. Retorne apenas o texto final.',
    },
    {
      role: 'user',
      content:
        `Instrucao: ${input.instruction}\n\n` +
        'Texto atual:\n' +
        input.content,
    },
  ]
}

export async function rewriteContentWithAi(input: RewriteWithAiInput): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Configure VITE_OPENROUTER_API_KEY para usar a IA.')
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Obsidian Premium Editor',
    },
    body: JSON.stringify({
      model: getModel(),
      temperature: 0.2,
      messages: buildMessages(input),
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter retornou erro (${response.status}).`)
  }

  const data = (await response.json()) as OpenRouterResponse
  const output = data.choices?.[0]?.message?.content?.trim()
  if (!output) {
    throw new Error('Resposta vazia da IA.')
  }

  return output
}
