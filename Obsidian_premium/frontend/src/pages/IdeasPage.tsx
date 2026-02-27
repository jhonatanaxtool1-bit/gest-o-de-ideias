import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocuments } from '@/modules/documents/useDocuments'
import { useOrganization } from '@/modules/organization/useOrganization'
import type { Document } from '@/modules/documents/types'

function generateGradient(id: string): string {
  const hues = [220, 260, 300, 340, 20, 60, 100, 160, 200]
  const hue1 = hues[id.charCodeAt(0) % hues.length]
  const hue2 = (hue1 + 40) % 360
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 50%))`
}

interface DeleteModalProps {
  isOpen: boolean
  idea: Document | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteModal({ isOpen, idea, onConfirm, onCancel }: DeleteModalProps) {
  if (!isOpen || !idea) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-surface-900 p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>

        <h3 className="mb-2 text-lg font-semibold text-zinc-100">Excluir Ideia</h3>
        <p className="mb-2 text-sm text-zinc-400">
          Esta ação excluirá permanentemente a ideia. Esta ação não pode ser desfeita.
        </p>
        <p className="mb-6 rounded-lg bg-zinc-800/50 px-3 py-2 text-sm font-medium text-zinc-300">
          {idea.title}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

interface IdeaCardProps {
  document: Document
  onEdit: (id: string) => void
  onDelete: (doc: Document) => void
}

function IdeaCard({ document, onEdit, onDelete }: IdeaCardProps) {
  const hasCover = document.cover && document.cover.trim() !== ''
  const backgroundImage = hasCover ? document.cover : generateGradient(document.id)
  const isUrl = typeof backgroundImage === 'string' && (
    backgroundImage.startsWith('http') ||
    backgroundImage.startsWith('data:image')
  )

  return (
    <div className="group relative bg-surface-800 rounded-xl border border-zinc-700/50 overflow-hidden hover:border-zinc-600/50 transition-all">
      <div
        className="h-32 w-full bg-cover bg-center relative"
        style={isUrl ? { backgroundImage: `url(${backgroundImage})` } : { background: backgroundImage }}
      >
        {!hasCover && (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}

        {/* Overlay com ações no hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(document.id)}
            className="px-4 py-2 rounded-lg bg-white/90 text-surface-900 text-sm font-medium hover:bg-white transition-colors"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(document)}
            className="px-4 py-2 rounded-lg bg-red-500/90 text-white text-sm font-medium hover:bg-red-500 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>

      <div className="p-4">
        <h4 className="text-zinc-200 font-semibold text-sm line-clamp-1 mb-1">{document.title}</h4>

        {document.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {document.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs text-zinc-500">#{tag}</span>
            ))}
            {document.tags.length > 3 && (
              <span className="text-xs text-zinc-600">+{document.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function IdeasPage() {
  const navigate = useNavigate()
  const { documents, remove } = useDocuments()
  const { interests, areas } = useOrganization()

  const [expandedInterests, setExpandedInterests] = useState<Set<string>>(
    () => new Set(interests[0] ? [interests[0].id] : [])
  )
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(() => new Set(areas.map(a => a.id)))
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; idea: Document | null }>({
    isOpen: false,
    idea: null,
  })

  useEffect(() => {
    setExpandedInterests(new Set(interests[0] ? [interests[0].id] : []))
    setExpandedAreas(new Set(areas.map(a => a.id)))
  }, [interests, areas])

  const toggleInterest = (interestId: string) => {
    setExpandedInterests((prev) => {
      if (prev.has(interestId)) return new Set()
      return new Set([interestId])
    })
  }

  const toggleArea = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) next.delete(areaId)
      else next.add(areaId)
      return next
    })
  }

  const handleNewIdea = () => {
    navigate('/ideia/new')
  }

  const handleEditIdea = (id: string) => {
    navigate(`/ideia/${id}`)
  }

  const handleDeleteClick = (doc: Document) => {
    setDeleteModal({ isOpen: true, idea: doc })
  }

  const handleConfirmDelete = async () => {
    if (deleteModal.idea) {
      await remove(deleteModal.idea.id)
    }
    setDeleteModal({ isOpen: false, idea: null })
  }

  const sortedInterests = useMemo(() => {
    return [...interests].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [interests])

  const getAreasByInterest = (interestId: string) => {
    return areas
      .filter((a) => a.interestId === interestId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }

  const getDocumentsByArea = (areaName: string) => {
    return documents
      .filter((d) => d.area === areaName)
      .filter((d) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
          d.title.toLowerCase().includes(query) ||
          d.content.toLowerCase().includes(query) ||
          d.tags.some((t) => t.toLowerCase().includes(query))
        )
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  }

  const getDocCountByArea = (areaName: string) => {
    return documents.filter((d) => d.area === areaName).length
  }

  return (
    <div className="h-full bg-surface-950 overflow-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">Lista de Ideias</h1>
            <p className="text-zinc-400 text-sm">Organizadas por Interesse → Área</p>
          </div>
          <button
            onClick={handleNewIdea}
            className="
              flex items-center gap-2 px-4 py-2.5 rounded-xl
              bg-accent text-white font-medium
              hover:bg-accent-bright transition-colors
              shadow-lg shadow-accent/20
            "
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova ideia
          </button>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar ideias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                w-full h-11 pl-11 pr-4 rounded-xl
                bg-surface-800 border border-zinc-700/50
                text-zinc-200 placeholder:text-zinc-500
                focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/20
                transition-all
              "
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-8">
          <div className="w-72 flex-shrink-0">
            <div className="rounded-lg border border-zinc-800/80 bg-surface-900/40 p-2">
              {sortedInterests.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-zinc-500">Nenhum interesse</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Crie em <span className="text-accent">Cadastros</span>
                  </p>
                </div>
              ) : (
              <div className="space-y-2">
              {sortedInterests.map((interest) => {
                const areaCount = getAreasByInterest(interest.id).length
                const isExpanded = expandedInterests.has(interest.id)

                return (
                  <div
                    key={interest.id}
                    className="rounded-md border border-zinc-800/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      className={`
                        w-full flex items-center justify-between gap-2
                        px-4 py-3.5 text-left
                        transition-colors
                        ${isExpanded ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'}
                      `}
                    >
                      <span className="text-sm font-medium text-accent/90 truncate">
                        {interest.name}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-accent/70 tabular-nums">{areaCount}</span>
                        <svg
                          className={`w-4 h-4 text-accent/70 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="bg-surface-950/50 py-1">
                        {getAreasByInterest(interest.id).map((area) => {
                          const areaDocCount = getDocCountByArea(area.name)
                          const isAreaExpanded = expandedAreas.has(area.id)

                          return (
                            <div key={area.id} className="border-t border-zinc-800/40 first:border-t-0">
                              <button
                                type="button"
                                onClick={() => toggleArea(area.id)}
                                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 pl-5 text-left hover:bg-zinc-800/20 transition-colors"
                              >
                                <span className="text-xs text-zinc-100 truncate uppercase tracking-wider">
                                  {area.name}
                                </span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-zinc-500 tabular-nums">{areaDocCount}</span>
                                  <svg
                                    className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${isAreaExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {sortedInterests.filter((i) => expandedInterests.has(i.id)).length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">Selecione um interesse para ver as ideias.</p>
            ) : (
              <div className="space-y-6">
                {sortedInterests.map((interest) => {
                  if (!expandedInterests.has(interest.id)) return null

                  const interestAreas = getAreasByInterest(interest.id)

                  return (
                    <div key={interest.id} className="space-y-4">
                      {interestAreas.map((area) => {
                        if (!expandedAreas.has(area.id)) return null

                        const areaDocs = getDocumentsByArea(area.name)

                        return (
                          <div key={area.id}>
                            <h3 className="text-xs font-medium uppercase tracking-wider mb-3">
                              <span className="text-accent/90">{interest.name}</span>
                              <span className="text-zinc-500"> → </span>
                              <span className="text-zinc-100">{area.name}</span>
                            </h3>
                            {areaDocs.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {areaDocs.map((doc) => (
                                  <IdeaCard
                                    key={doc.id}
                                    document={doc}
                                    onEdit={handleEditIdea}
                                    onDelete={handleDeleteClick}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="py-6 rounded-lg bg-zinc-900/30 border border-zinc-800/50 text-center">
                                <p className="text-sm text-zinc-500">Nenhuma ideia nesta área</p>
                                <button
                                  type="button"
                                  onClick={handleNewIdea}
                                  className="text-accent text-sm mt-1 hover:underline"
                                >
                                  Criar uma ideia
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <DeleteModal
        isOpen={deleteModal.isOpen}
        idea={deleteModal.idea}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, idea: null })}
      />
    </div>
  )
}
