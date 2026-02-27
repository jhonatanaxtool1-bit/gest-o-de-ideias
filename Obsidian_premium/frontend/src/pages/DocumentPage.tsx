import { useParams, useNavigate } from 'react-router-dom'
import { useDocuments } from '@/modules/documents/useDocuments'
import { DocumentEditor } from '@/components/DocumentEditor'
import { useEffect, useMemo, useState } from 'react'
import type { Document } from '@/modules/documents/types'

const emptyDoc: Document = {
  id: '',
  title: '',
  cover: '',
  content: '',
  interest: '',
  area: '',
  tags: [],
  relations: [],
  createdAt: '',
}

export function DocumentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { documents, getById, create, update, syncRelations, refresh } = useDocuments()
  const [doc, setDoc] = useState<Document | null>(id === 'new' ? emptyDoc : null)

  useEffect(() => {
    if (id && id !== 'new') {
      const next = getById(id)
      setDoc(next ?? null)
    } else if (id === 'new') {
      setDoc(emptyDoc)
    }
  }, [id, getById, documents])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const currentDoc = useMemo(() => doc, [doc])
  const isNew = id === 'new' || !currentDoc?.id

  const handleSave = async (payload: { title: string; cover: string; content: string; interest: string; area: string; tags: string[] }) => {
    if (isNew) {
      const created = await create({
        ...payload,
        relations: [],
      })
      if (!created) return
      await syncRelations(created.id, payload.content)
      await refresh()
      navigate(`/doc/${created.id}`, { replace: true })
      setDoc(getById(created.id) ?? null)
      return
    }
    if (!currentDoc?.id) return
    await update(currentDoc.id, payload)
    await syncRelations(currentDoc.id, payload.content)
    await refresh()
    setDoc(getById(currentDoc.id) ?? null)
  }

  if (id && id !== 'new' && !currentDoc) {
    return (
      <div className="mx-auto w-full max-w-[840px] px-10 py-12 text-zinc-500">
        Documento não encontrado.
      </div>
    )
  }

  if (!currentDoc) return null

  return (
    <div className="mx-auto w-full max-w-[840px] px-10 py-12">
      <DocumentEditor
        doc={currentDoc}
        onSave={handleSave}
      />
    </div>
  )
}
