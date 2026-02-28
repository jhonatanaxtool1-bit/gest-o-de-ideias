import type { Document, DocumentCreate, DocumentUpdate, Relation } from './types'
import { hasDocumentsStorageValue, loadDocuments, saveDocuments } from '@/storage/documentStorage'
import { extractWikiLinks } from '@/utils/linkParser'
import { uuid } from '@/utils/uuid'

function generateId(): string {
  return uuid()
}

function now(): string {
  return new Date().toISOString()
}

export function getAllDocuments(): Document[] {
  return loadDocuments()
}

export function getDocumentById(id: string): Document | undefined {
  return loadDocuments().find((d) => d.id === id)
}

export function findDocumentByTitle(title: string): Document | undefined {
  const normalized = title.trim().toLowerCase()
  return loadDocuments().find((d) => d.title.trim().toLowerCase() === normalized)
}

export function createDocument(input: DocumentCreate): Document {
  const docs = loadDocuments()
  const doc: Document = {
    id: generateId(),
    createdAt: now(),
    title: input.title || 'Sem título',
    cover: input.cover ?? '',
    content: input.content ?? '',
    interest: input.interest ?? '',
    area: input.area ?? '',
    tags: input.tags ?? [],
    relations: input.relations ?? [],
  }
  docs.push(doc)
  saveDocuments(docs)
  return doc
}

export function updateDocument(id: string, update: DocumentUpdate): Document | undefined {
  const docs = loadDocuments()
  const index = docs.findIndex((d) => d.id === id)
  if (index === -1) return undefined
  docs[index] = { ...docs[index], ...update }
  saveDocuments(docs)
  return docs[index]
}

export function syncRelationsFromContent(docId: string, content: string, allDocs: Document[]): void {
  const titles = extractWikiLinks(content)
  const relations: Relation[] = []
  const doc = allDocs.find((d) => d.id === docId)
  if (!doc) return
  const titleToId = new Map(allDocs.map((d) => [d.title.trim().toLowerCase(), d.id]))
  for (const title of titles) {
    const targetId = titleToId.get(title.trim().toLowerCase())
    if (targetId && targetId !== docId) {
      relations.push({ targetId, type: 'link' })
    }
  }
  updateDocument(docId, { relations })
}

export function getBacklinks(docId: string, allDocs: Document[]): Document[] {
  return allDocs.filter((d) => d.relations.some((r) => r.targetId === docId))
}

export function deleteDocument(id: string): boolean {
  const docs = loadDocuments()
  const filtered = docs.filter((d) => d.id !== id)
  if (filtered.length === docs.length) return false
  saveDocuments(filtered)
  return true
}

function ensureSeed(docs: Document[]): Document[] {
  if (docs.length > 0) return docs
  if (hasDocumentsStorageValue()) return docs

  const seed: Document[] = [
    {
      id: generateId(),
      title: 'Bem-vindo',
      cover: '',
      content: 'Este é seu **Second Brain**.\n\nCrie notas e ligue com [[links internos]].\n\nExemplo: [[Produtividade]] e [[Ideias]].',
      interest: 'Pessoal',
      area: 'Inbox',
      tags: ['início'],
      relations: [],
      createdAt: now(),
    },
    {
      id: generateId(),
      title: 'Produtividade',
      cover: '',
      content: 'Técnicas e [[Bem-vindo]] para fazer mais.\n\nRelacionado: [[Ideias]].',
      interest: 'Pessoal',
      area: 'Áreas',
      tags: ['produtividade'],
      relations: [],
      createdAt: now(),
    },
    {
      id: generateId(),
      title: 'Ideias',
      cover: '',
      content: 'Caixa de ideias. Link de volta: [[Bem-vindo]], [[Produtividade]].',
      interest: 'Pessoal',
      area: 'Áreas',
      tags: ['ideias'],
      relations: [],
      createdAt: now(),
    },
  ]
  saveDocuments(seed)
  return seed
}

export function getDocumentsWithSeed(): Document[] {
  const docs = loadDocuments()
  const resolved = ensureSeed(docs)
  resolved.forEach((d) => syncRelationsFromContent(d.id, d.content, resolved))
  return loadDocuments()
}
