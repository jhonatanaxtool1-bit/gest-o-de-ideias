import type { PlanningCard, PlanningCardCreateInput, PlanningCardUpdateInput } from './types'

const DEFAULT_API_BASE_URL = ''
const API_PREFIX = '/api/professional-planning/cards'

class ProfessionalPlanningError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfessionalPlanningError'
  }
}

function getBaseUrl(): string {
  const envBase = import.meta.env.VITE_API_BASE_URL
  if (typeof envBase === 'string') return envBase.trim()
  return DEFAULT_API_BASE_URL
}

function getEndpoint(path: string): string {
  return `${getBaseUrl()}${API_PREFIX}${path}`
}

function genId(): string {
  return crypto.randomUUID()
}

function normalizeCards(value: unknown): PlanningCard[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Partial<PlanningCard> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : genId(),
      title: typeof item.title === 'string' ? item.title : '',
      status:
        item.status === 'todo' || item.status === 'doing' || item.status === 'done' || item.status === 'nostatus'
          ? item.status
          : 'nostatus',
      priority: item.priority === 'low' || item.priority === 'medium' || item.priority === 'high' ? item.priority : 'low',
      isFinalized: typeof item.isFinalized === 'boolean' ? item.isFinalized : false,
      completedAt: typeof item.completedAt === 'string' ? item.completedAt : null,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now(),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now(),
    }))
    .filter((item) => item.title.trim().length > 0)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  let response: Response
  try {
    response = await fetch(getEndpoint(path), {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ProfessionalPlanningError('Servidor indisponível no momento.')
  }

  if (!response.ok) {
    let message = response.status === 401 ? 'Token inválido ou ausente.' : 'Falha ao processar solicitação do Kanban.'
    try {
      const data = await response.json()
      if (typeof data?.message === 'string' && data.message.trim().length > 0) {
        message = data.message
      }
    } catch {
      // Keep default message when body is not JSON.
    }
    throw new ProfessionalPlanningError(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const rawBody = await response.text()
  if (!rawBody.trim()) {
    return undefined as T
  }

  try {
    return JSON.parse(rawBody) as T
  } catch {
    throw new ProfessionalPlanningError('Resposta inválida da API do Kanban.')
  }
}

export async function getPlanningCards(): Promise<PlanningCard[]> {
  const payload = await request<unknown>('')
  return normalizeCards(payload)
}

export async function createPlanningCard(input: PlanningCardCreateInput): Promise<PlanningCard> {
  const payload = await request<unknown>('', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      id: genId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFinalized: false,
      completedAt: null,
    }),
  })
  const [created] = normalizeCards([payload])
  if (!created) throw new ProfessionalPlanningError('Resposta inválida ao criar card.')
  return created
}

export async function updatePlanningCard(id: string, input: PlanningCardUpdateInput): Promise<PlanningCard> {
  const payload = await request<unknown>(`/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  const [updated] = normalizeCards([payload])
  if (!updated) throw new ProfessionalPlanningError('Resposta inválida ao atualizar card.')
  return updated
}

export async function deletePlanningCard(id: string): Promise<void> {
  await request<void>(`/${id}`, { method: 'DELETE' })
}

export { ProfessionalPlanningError }
