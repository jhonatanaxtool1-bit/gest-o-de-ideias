export type DailyTask = {
  id: string
  title: string
  done: boolean
  createdAt: string
}

const BASE = '/api/daily-tasks'

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

export async function fetchDailyTasksApi(): Promise<DailyTask[]> {
  const res = await fetch(BASE)
  return (await handleResponse(res)) as DailyTask[]
}

export async function createDailyTaskApi(task: DailyTask): Promise<DailyTask> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })
  return (await handleResponse(res)) as DailyTask
}

export async function updateDailyTaskApi(id: string, payload: Partial<DailyTask>): Promise<DailyTask> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await handleResponse(res)) as DailyTask
}

export async function deleteDailyTaskApi(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await handleResponse(res)
}
