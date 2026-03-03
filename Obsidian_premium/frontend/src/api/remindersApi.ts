export type ReminderRecurrence = 'once' | 'daily' | 'every_2_days' | 'weekly'

export type Reminder = {
  id: string
  title: string
  body: string
  firstDueAt: string
  recurrence: ReminderRecurrence
  lastTriggeredAt: string | null
  createdAt: string
  updatedAt: string
}

export type ReminderCreateInput = {
  title: string
  body?: string
  firstDueAt: string
  recurrence?: ReminderRecurrence
}

export type ReminderUpdateInput = Partial<Pick<Reminder, 'title' | 'body' | 'firstDueAt' | 'recurrence'>>

const BASE = '/api/reminders'

async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text()
    let message = text || res.statusText
    try {
      const json = JSON.parse(text) as { message?: string }
      if (json.message) message = json.message
    } catch {
      // keep message as text
    }
    throw new Error(message)
  }
  if (res.status === 204) return null
  return res.json()
}

function getBaseUrl(): string {
  const envBase = import.meta.env.VITE_API_BASE_URL
  if (typeof envBase === 'string' && envBase.trim()) return envBase.trim()
  return ''
}

function url(path: string): string {
  return `${getBaseUrl()}${BASE}${path}`
}

export async function fetchRemindersApi(): Promise<Reminder[]> {
  const res = await fetch(url(''))
  return (await handleResponse(res)) as Reminder[]
}

export async function fetchReminderApi(id: string): Promise<Reminder> {
  const res = await fetch(url(`/${encodeURIComponent(id)}`))
  return (await handleResponse(res)) as Reminder
}

export async function createReminderApi(input: ReminderCreateInput): Promise<Reminder> {
  const res = await fetch(url(''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      body: input.body ?? '',
      firstDueAt: input.firstDueAt,
      recurrence: input.recurrence ?? 'once',
    }),
  })
  return (await handleResponse(res)) as Reminder
}

export async function updateReminderApi(id: string, payload: ReminderUpdateInput): Promise<Reminder> {
  const res = await fetch(url(`/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await handleResponse(res)) as Reminder
}

export async function deleteReminderApi(id: string): Promise<void> {
  const res = await fetch(url(`/${encodeURIComponent(id)}`), { method: 'DELETE' })
  await handleResponse(res)
}

export const RECURRENCE_LABELS: Record<ReminderRecurrence, string> = {
  once: 'Uma vez (só hoje)',
  daily: 'Diário',
  every_2_days: 'A cada 2 dias',
  weekly: 'Semanal',
}
