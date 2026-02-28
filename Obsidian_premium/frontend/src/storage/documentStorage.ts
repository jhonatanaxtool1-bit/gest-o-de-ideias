import type { Document } from '@/modules/documents/types'
import { fetchDocuments as fetchDocsApi, createDocumentApi, updateDocumentApi, deleteDocumentApi } from '@/api/documentsApi'
import { uuid } from '@/utils/uuid'

const STORAGE_KEY = 'obsidian-premium-documents'

export function hasDocumentsStorageValue(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

function normalizeDocument(doc: Partial<Document>): { normalized: Document; changed: boolean } {
  const hasValidId = typeof doc.id === 'string' && doc.id.trim().length > 0
  const hasValidTitle = typeof doc.title === 'string'
  const hasValidCover = typeof doc.cover === 'string'
  const hasValidContent = typeof doc.content === 'string'
  const hasValidInterest = typeof doc.interest === 'string'
  const hasValidArea = typeof doc.area === 'string'
  const hasValidTags = Array.isArray(doc.tags)
  const hasValidRelations = Array.isArray(doc.relations)
  const hasValidCreatedAt = typeof doc.createdAt === 'string' && doc.createdAt.trim().length > 0

  const normalized: Document = {
    id: hasValidId ? doc.id! : uuid(),
    title: hasValidTitle ? doc.title! : 'Sem título',
    cover: hasValidCover ? doc.cover! : '',
    content: hasValidContent ? doc.content! : '',
    interest: hasValidInterest ? doc.interest! : '',
    area: hasValidArea ? doc.area! : '',
    tags: hasValidTags ? doc.tags! : [],
    relations: hasValidRelations ? doc.relations! : [],
    createdAt: hasValidCreatedAt ? doc.createdAt! : new Date().toISOString(),
  }

  const changed = !(
    hasValidId &&
    hasValidTitle &&
    hasValidCover &&
    hasValidContent &&
    hasValidInterest &&
    hasValidArea &&
    hasValidTags &&
    hasValidRelations &&
    hasValidCreatedAt
  )

  return {
    normalized,
    changed,
  }
}

export function loadDocuments(): Document[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<Document>[]
    if (!Array.isArray(parsed)) return []

    let needsSave = false
    const normalized = parsed.map((doc) => {
      const result = normalizeDocument(doc)
      if (result.changed) needsSave = true
      return result.normalized
    })

    if (needsSave) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }

    return normalized
  } catch {
    return []
  }
}

/**
 * Save locally (synchronous) and start background sync to backend (SQLite API).
 * This keeps the existing synchronous contract while persisting server-side asynchronously.
 */
export function saveDocuments(docs: Document[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))

  // Fire-and-forget sync to server to persist current state.
  ;(async () => {
    try {
      const serverDocs = await fetchDocsApi().catch(() => []) // tolerate server offline
      const serverById = new Map(serverDocs.map((d) => [d.id, d]))
      const localById = new Map(docs.map((d) => [d.id, d]))

      // Upsert local -> server
      for (const doc of docs) {
        if (serverById.has(doc.id)) {
          try {
            await updateDocumentApi(doc.id, doc)
          } catch (e) {
            // ignore per-item errors
            // console.warn('sync update failed', e)
          }
        } else {
          try {
            await createDocumentApi(doc)
          } catch (e) {
            // ignore
          }
        }
      }

      // Delete server docs that are not present locally
      for (const serverDoc of serverDocs) {
        if (!localById.has(serverDoc.id)) {
          try {
            await deleteDocumentApi(serverDoc.id)
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // best-effort only
    }
  })()
}
