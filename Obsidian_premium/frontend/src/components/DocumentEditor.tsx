import { useState, useCallback, useRef, useEffect } from 'react'
import type { Document } from '@/modules/documents/types'
import { useOrganization } from '@/modules/organization/useOrganization'

interface DocumentEditorProps {
  doc: Document
  onSave: (payload: { title: string; cover: string; content: string; interest: string; area: string; tags: string[] }) => void
}

export function DocumentEditor({ doc, onSave }: DocumentEditorProps) {
  const [title, setTitle] = useState(doc.title)
  const [cover, setCover] = useState(doc.cover)
  const [content, setContent] = useState(doc.content)
  const [interest, setInterest] = useState(doc.interest)
  const [area, setArea] = useState(doc.area)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasEditedRef = useRef(false)
  const { interests, areasByInterestId } = useOrganization()

  const markAsEdited = useCallback(() => {
    hasEditedRef.current = true
  }, [])

  const handleCoverChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      markAsEdited()
      setCover(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [markAsEdited])

  const saveDocument = useCallback(() => {
    onSave({
      title: title.trim() || 'Sem título',
      cover,
      content,
      interest: interest.trim(),
      area: area.trim(),
      tags: doc.tags,
    })
  }, [title, cover, content, interest, area, doc.tags, onSave])

  useEffect(() => {
    if (!hasEditedRef.current) return
    const timer = window.setTimeout(() => {
      saveDocument()
    }, 600)
    return () => window.clearTimeout(timer)
  }, [title, cover, content, interest, area, saveDocument])

  const selectedInterest = interests.find((item) => item.name === interest)
  const filteredAreas = selectedInterest ? (areasByInterestId.get(selectedInterest.id) ?? []) : []

  return (
    <article className="animate-fade-in text-zinc-300">
      <div className="mb-8">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleCoverChange}
        />
        <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-left text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            {cover ? 'Alterar capa' : '+ Adicionar capa'}
          </button>
          <select
            value={interest}
            onChange={(e) => {
              markAsEdited()
              const selectedName = e.target.value
              setInterest(selectedName)
              const interestObj = interests.find((item) => item.name === selectedName)
              if (!interestObj) {
                setArea('')
                return
              }
              const availableAreas = areasByInterestId.get(interestObj.id) ?? []
              const hasArea = availableAreas.some((item) => item.name === area)
              if (!hasArea) setArea(availableAreas[0]?.name ?? '')
            }}
            className="h-7 min-w-[160px] border-none bg-transparent p-0 text-sm text-zinc-400 focus:outline-none"
          >
            <option value="" className="bg-surface-950 text-zinc-300">Interesse</option>
            {interests.map((item) => (
              <option key={item.id} value={item.name} className="bg-surface-950 text-zinc-300">
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={area}
            onChange={(e) => {
              markAsEdited()
              setArea(e.target.value)
            }}
            className="h-7 min-w-[220px] border-none bg-transparent p-0 text-sm text-zinc-400 focus:outline-none"
            disabled={!selectedInterest}
          >
            <option value="" className="bg-surface-950 text-zinc-300">Área</option>
            {filteredAreas.map((item) => (
              <option key={item.id} value={item.name} className="bg-surface-950 text-zinc-300">
                {item.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-600">Salvamento automatico</span>
        </div>
        {cover && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mb-6 block h-52 w-full overflow-hidden bg-surface-900/30"
          >
            <img src={cover} alt="" className="w-full h-full object-cover" />
          </button>
        )}
        <input
          type="text"
          value={title}
          onChange={(e) => {
            markAsEdited()
            setTitle(e.target.value)
          }}
          placeholder="Título"
          className="w-full bg-transparent text-[42px] leading-tight font-semibold tracking-tight text-zinc-100 placeholder-zinc-600 border-none focus:outline-none focus:ring-0"
        />
      </div>

      <div className="mb-12">
        <textarea
          value={content}
          onChange={(e) => {
            markAsEdited()
            setContent(e.target.value)
          }}
          placeholder="Comece a escrever..."
          className="w-full min-h-[56vh] resize-y border-none bg-transparent p-0 text-[16px] leading-8 text-zinc-300 placeholder-zinc-600 focus:outline-none"
          spellCheck
        />
      </div>
    </article>
  )
}
