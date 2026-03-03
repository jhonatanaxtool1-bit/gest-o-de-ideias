import type { List, ListItem } from '@/modules/lists/types'

const BASE = '/api/lists'

async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function fetchLists(): Promise<List[]> {
  const res = await fetch(BASE)
  return (await handleResponse(res)) as List[]
}

export async function fetchListById(id: string): Promise<List | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`)
  return (await handleResponse(res)) as List
}

export async function createListApi(payload: {
  id: string
  title: string
  listType: string
  createdAt: string
  updatedAt: string
  items?: { id: string; label: string; order: number; done: boolean; createdAt: string }[]
}): Promise<List> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await handleResponse(res)) as List
}

export async function updateListApi(id: string, payload: { title?: string; listType?: string; items?: ListItem[] }): Promise<List> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await handleResponse(res)) as List
}

export async function deleteListApi(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await handleResponse(res)
}

export async function addListItemApi(listId: string, item: { id: string; label: string; order: number; done: boolean; createdAt: string }): Promise<ListItem> {
  const res = await fetch(`${BASE}/${encodeURIComponent(listId)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })
  return (await handleResponse(res)) as ListItem
}

export async function updateListItemApi(listId: string, itemId: string, payload: { label?: string; order?: number; done?: boolean }): Promise<ListItem> {
  const res = await fetch(`${BASE}/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await handleResponse(res)) as ListItem
}

export async function deleteListItemApi(listId: string, itemId: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
  await handleResponse(res)
}
