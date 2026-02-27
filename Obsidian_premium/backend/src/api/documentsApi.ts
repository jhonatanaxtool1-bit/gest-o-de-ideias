import type { Document } from '@/modules/documents/types'

const BASE = '/api/documents'

async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch(BASE)
  return (await handleResponse(res)) as Document[]
}

export async function fetchDocumentById(id: string): Promise<Document | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`)
  return (await handleResponse(res)) as Document
}

export async function createDocumentApi(doc: Document): Promise<Document> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  })
  return (await handleResponse(res)) as Document
}

export async function updateDocumentApi(id: string, payload: Partial<Document>): Promise<Document> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await handleResponse(res)) as Document
}

export async function deleteDocumentApi(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await handleResponse(res)
}

