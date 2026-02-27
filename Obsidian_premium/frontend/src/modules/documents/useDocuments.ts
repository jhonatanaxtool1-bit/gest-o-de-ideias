import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Document, DocumentCreate, DocumentUpdate } from './types'
import {
  createDocumentApi,
  deleteDocumentApi,
  fetchDocuments,
  updateDocumentApi,
} from '@/api/documentsApi'
import { extractWikiLinks } from '@/utils/linkParser'

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const docs = await fetchDocuments()
      setDocuments(docs)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const getById = useCallback((id: string) => documents.find((d) => d.id === id), [documents])

  const getByTitle = useCallback(
    (title: string) => {
      const normalized = title.trim().toLowerCase()
      return documents.find((d) => d.title.trim().toLowerCase() === normalized)
    },
    [documents]
  )

  const create = useCallback(async (input: DocumentCreate): Promise<Document | null> => {
    const payload: Document = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: input.title || 'Sem título',
      cover: input.cover ?? '',
      content: input.content ?? '',
      interest: input.interest ?? '',
      area: input.area ?? '',
      tags: input.tags ?? [],
      relations: input.relations ?? [],
    }
    const created = await createDocumentApi(payload)
    setDocuments((prev) => [...prev, created])
    return created
  }, [])

  const update = useCallback(async (id: string, payload: DocumentUpdate): Promise<Document | undefined> => {
    const updated = await updateDocumentApi(id, payload as Partial<Document>)
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? updated : doc)))
    return updated
  }, [])

  const syncRelations = useCallback(async (docId: string, content: string) => {
    const titleToId = new Map(documents.map((d) => [d.title.trim().toLowerCase(), d.id]))
    const relationIds = extractWikiLinks(content)
      .map((title) => titleToId.get(title.trim().toLowerCase()))
      .filter((targetId): targetId is string => Boolean(targetId) && targetId !== docId)

    const relations = relationIds.map((targetId) => ({ targetId, type: 'link' }))
    const updated = await updateDocumentApi(docId, { relations })
    setDocuments((prev) => prev.map((doc) => (doc.id === docId ? updated : doc)))
  }, [documents])

  const backlinks = useCallback((docId: string): Document[] => {
    return documents.filter((d) => d.relations.some((r) => r.targetId === docId))
  }, [documents])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    await deleteDocumentApi(id)
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))
    return true
  }, [])

  const memoDocuments = useMemo(() => documents, [documents])

  return {
    documents: memoDocuments,
    isLoaded,
    getById,
    getByTitle,
    create,
    update,
    remove,
    syncRelations,
    backlinks,
    refresh,
  }
}
