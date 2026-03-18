import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocuments } from '@/modules/documents/useDocuments'
import { useOrganization } from '@/modules/organization/useOrganization'
import type { Document } from '@/modules/documents/types'
import type { Interest, Area } from '@/modules/organization/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

const INTEREST_COLORS = [
  '#7c8aff', '#ff7ca3', '#7cdfff', '#ffb07c',
  '#a3ff7c', '#d07cff', '#ffec7c', '#7cffd4',
]

function getInterestColor(index: number): string {
  return INTEREST_COLORS[index % INTEREST_COLORS.length]
}

function generateGradient(id: string): string {
  const hues = [220, 260, 300, 340, 20, 60, 100, 160, 200]
  const hue1 = hues[id.charCodeAt(0) % hues.length]
  const hue2 = (hue1 + 40) % 360
  return `linear-gradient(135deg, hsl(${hue1}, 60%, 35%), hsl(${hue2}, 60%, 25%))`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

type SortOption = 'newest' | 'oldest' | 'az' | 'za'
type ViewMode = 'grid' | 'list'

// ─── Delete Modal ────────────────────────────────────────────────────────────

interface DeleteModalProps {
  isOpen: boolean
  idea: Document | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteModal({ isOpen, idea, onConfirm, onCancel }: DeleteModalProps) {
  if (!isOpen || !idea) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-surface-900 p-6 shadow-2xl animate-slide-in">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15">
          <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="mb-1.5 text-base font-semibold text-zinc-100">Excluir Ideia</h3>
        <p className="mb-2 text-sm text-zinc-400">Esta ação não pode ser desfeita.</p>
        <p className="mb-6 rounded-lg bg-zinc-800/60 px-3 py-2 text-sm font-medium text-zinc-300 line-clamp-2">
          {idea.title}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Idea Card (Grid) ─────────────────────────────────────────────────────────

interface IdeaCardProps {
  document: Document
  color: string
  onEdit: (id: string) => void
  onDelete: (doc: Document) => void
}

function IdeaCard({ document, color, onEdit, onDelete }: IdeaCardProps) {
  const hasCover = document.cover && document.cover.trim() !== ''
  const backgroundImage = hasCover ? document.cover : generateGradient(document.id)
  const isUrl = typeof backgroundImage === 'string' &&
    (backgroundImage.startsWith('http') || backgroundImage.startsWith('data:image'))

  return (
    <div className="group relative flex flex-col bg-surface-800 rounded-2xl border border-zinc-700/40 overflow-hidden hover:border-zinc-600/60 hover:shadow-lg hover:shadow-black/30 transition-all duration-200">
      {/* Cover */}
      <div
        className="h-36 w-full bg-cover bg-center relative flex-shrink-0"
        style={isUrl ? { backgroundImage: `url(${backgroundImage})` } : { background: backgroundImage }}
      >
        {!hasCover && (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        )}

        {/* Hover overlay — desktop only */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors hidden md:flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(document.id)}
            className="px-3.5 py-1.5 rounded-lg bg-white/90 text-surface-900 text-xs font-semibold hover:bg-white transition-colors"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(document)}
            className="px-3.5 py-1.5 rounded-lg bg-red-500/90 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Breadcrumb */}
        {(document.interest || document.area) && (
          <div className="flex items-center gap-1 text-xs">
            {document.interest && (
              <span className="font-medium truncate" style={{ color }}>
                {document.interest}
              </span>
            )}
            {document.interest && document.area && (
              <span className="text-zinc-600">›</span>
            )}
            {document.area && (
              <span className="text-zinc-500 truncate">{document.area}</span>
            )}
          </div>
        )}

        <h4 className="text-zinc-100 font-semibold text-sm line-clamp-2 leading-snug flex-1">
          {document.title}
        </h4>

        {/* Tags */}
        {document.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {document.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded-md bg-zinc-700/50 text-zinc-400"
              >
                #{tag}
              </span>
            ))}
            {document.tags.length > 3 && (
              <span className="text-xs text-zinc-600">+{document.tags.length - 3}</span>
            )}
          </div>
        )}

        <p className="text-xs text-zinc-600">{formatDate(document.createdAt)}</p>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-2 pt-2 border-t border-zinc-700/40">
          <button
            type="button"
            onClick={() => onEdit(document.id)}
            className="flex-1 py-2 rounded-lg bg-zinc-700/40 text-zinc-200 text-xs font-medium hover:bg-zinc-700/70 transition-colors"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(document)}
            className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Idea List Item ───────────────────────────────────────────────────────────

interface IdeaListItemProps {
  document: Document
  color: string
  onEdit: (id: string) => void
  onDelete: (doc: Document) => void
}

function IdeaListItem({ document, color, onEdit, onDelete }: IdeaListItemProps) {
  const hasCover = document.cover && document.cover.trim() !== ''
  const backgroundImage = hasCover ? document.cover : generateGradient(document.id)
  const isUrl = typeof backgroundImage === 'string' &&
    (backgroundImage.startsWith('http') || backgroundImage.startsWith('data:image'))

  return (
    <div className="group flex items-center gap-3 p-3 bg-surface-800 rounded-xl border border-zinc-700/40 hover:border-zinc-600/60 hover:bg-surface-800/80 transition-all">
      {/* Thumbnail */}
      <div
        className="w-12 h-12 rounded-lg bg-cover bg-center flex-shrink-0 flex items-center justify-center"
        style={isUrl ? { backgroundImage: `url(${backgroundImage})` } : { background: backgroundImage }}
      >
        {!hasCover && (
          <svg className="w-5 h-5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          {document.interest && (
            <span className="text-xs font-medium" style={{ color }}>{document.interest}</span>
          )}
          {document.interest && document.area && (
            <span className="text-zinc-600 text-xs">›</span>
          )}
          {document.area && (
            <span className="text-xs text-zinc-500">{document.area}</span>
          )}
        </div>
        <h4 className="text-sm font-medium text-zinc-100 truncate">{document.title}</h4>
        <div className="flex items-center gap-2 mt-1">
          {document.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs text-zinc-500">#{tag}</span>
          ))}
          {document.tags.length > 2 && (
            <span className="text-xs text-zinc-600">+{document.tags.length - 2}</span>
          )}
        </div>
      </div>

      {/* Date + Actions */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <span className="text-xs text-zinc-600 hidden sm:block">{formatDate(document.createdAt)}</span>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(document.id)}
            className="px-2.5 py-1 rounded-lg bg-zinc-700/60 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(document)}
            className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
          >
            Excluir
          </button>
        </div>
        {/* Mobile actions always visible */}
        <div className="flex md:hidden items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(document.id)}
            className="px-2.5 py-1 rounded-lg bg-zinc-700/60 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(document)}
            className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter Sidebar Content ───────────────────────────────────────────────────

interface FilterPanelProps {
  interests: Interest[]
  areas: Area[]
  selectedInterestId: string | null
  selectedAreaId: string | null
  documents: Document[]
  onSelectInterest: (id: string | null) => void
  onSelectArea: (id: string | null) => void
  interestColorMap: Map<string, string>
}

function FilterPanel({
  interests,
  areas,
  selectedInterestId,
  selectedAreaId,
  documents,
  onSelectInterest,
  onSelectArea,
  interestColorMap,
}: FilterPanelProps) {
  const getDocCountByInterest = (interestName: string) =>
    documents.filter((d) => d.interest === interestName).length

  const getDocCountByArea = (areaName: string) =>
    documents.filter((d) => d.area === areaName).length

  const selectedInterest = interests.find((i) => i.id === selectedInterestId)
  const filteredAreas = selectedInterestId
    ? areas.filter((a) => a.interestId === selectedInterestId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    : []

  return (
    <div className="flex flex-col gap-1">
      {/* All */}
      <button
        type="button"
        onClick={() => { onSelectInterest(null); onSelectArea(null) }}
        className={`flex items-center justify-between gap-2 w-full px-3 py-2.5 rounded-xl text-sm transition-colors ${
          selectedInterestId === null
            ? 'bg-accent/15 text-accent font-medium'
            : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-zinc-500 flex-shrink-0" />
          <span>Todas as ideias</span>
        </div>
        <span className={`text-xs tabular-nums ${selectedInterestId === null ? 'text-accent/70' : 'text-zinc-600'}`}>
          {documents.length}
        </span>
      </button>

      {/* Interests */}
      <div className="pt-2 border-t border-zinc-800/60">
        <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-600">
          Interesses
        </p>
        <div className="space-y-0.5">
          {interests.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((interest) => {
            const color = interestColorMap.get(interest.id) ?? '#7c8aff'
            const isSelected = selectedInterestId === interest.id
            const count = getDocCountByInterest(interest.name)

            return (
              <div key={interest.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onSelectInterest(null)
                      onSelectArea(null)
                    } else {
                      onSelectInterest(interest.id)
                      onSelectArea(null)
                    }
                  }}
                  className={`flex items-center justify-between gap-2 w-full px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    isSelected
                      ? 'bg-zinc-800/80 text-zinc-100 font-medium'
                      : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{interest.name}</span>
                  </div>
                  <span className="text-xs tabular-nums text-zinc-600">{count}</span>
                </button>

                {/* Area sub-list */}
                {isSelected && filteredAreas.length > 0 && (
                  <div className="ml-4 mt-0.5 mb-1 border-l border-zinc-800/60 pl-2 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => onSelectArea(null)}
                      className={`flex items-center justify-between gap-2 w-full px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        selectedAreaId === null
                          ? 'text-zinc-200 font-medium bg-zinc-800/40'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                      }`}
                    >
                      <span>Todas as áreas</span>
                      <span className="tabular-nums text-zinc-600">
                        {documents.filter((d) => d.interest === selectedInterest?.name).length}
                      </span>
                    </button>
                    {filteredAreas.map((area) => {
                      const areaCount = getDocCountByArea(area.name)
                      const isAreaSelected = selectedAreaId === area.id
                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => onSelectArea(isAreaSelected ? null : area.id)}
                          className={`flex items-center justify-between gap-2 w-full px-2.5 py-2 rounded-lg text-xs transition-colors ${
                            isAreaSelected
                              ? 'text-zinc-200 font-medium bg-zinc-800/40'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                          }`}
                        >
                          <span className="truncate">{area.name}</span>
                          <span className="tabular-nums text-zinc-600">{areaCount}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {interests.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-zinc-600">Nenhum interesse</p>
              <p className="text-xs text-zinc-700 mt-0.5">Crie em Cadastros</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function IdeasPage() {
  const navigate = useNavigate()
  const { documents, remove } = useDocuments()
  const { interests, areas } = useOrganization()

  const [selectedInterestId, setSelectedInterestId] = useState<string | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; idea: Document | null }>({
    isOpen: false,
    idea: null,
  })

  // Build interest → color map (stable by index in sorted order)
  const interestColorMap = useMemo(() => {
    const sorted = [...interests].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const map = new Map<string, string>()
    sorted.forEach((interest, i) => map.set(interest.id, getInterestColor(i)))
    return map
  }, [interests])

  const getColorForDoc = useCallback(
    (doc: Document) => {
      const interest = interests.find((i) => i.name === doc.interest)
      return interest ? (interestColorMap.get(interest.id) ?? '#7c8aff') : '#7c8aff'
    },
    [interests, interestColorMap]
  )

  const selectedInterest = interests.find((i) => i.id === selectedInterestId)
  const selectedArea = areas.find((a) => a.id === selectedAreaId)

  const filteredDocuments = useMemo(() => {
    let docs = [...documents]

    if (selectedInterestId && selectedInterest) {
      docs = docs.filter((d) => d.interest === selectedInterest.name)
    }

    if (selectedAreaId && selectedArea) {
      docs = docs.filter((d) => d.area === selectedArea.name)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q)) ||
          d.interest?.toLowerCase().includes(q) ||
          d.area?.toLowerCase().includes(q)
      )
    }

    switch (sortBy) {
      case 'newest':
        docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        docs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'az':
        docs.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
        break
      case 'za':
        docs.sort((a, b) => b.title.localeCompare(a.title, 'pt-BR'))
        break
    }

    return docs
  }, [documents, selectedInterestId, selectedAreaId, selectedInterest, selectedArea, searchQuery, sortBy])

  const handleSelectInterest = (id: string | null) => {
    setSelectedInterestId(id)
    setSelectedAreaId(null)
  }

  const clearFilters = () => {
    setSelectedInterestId(null)
    setSelectedAreaId(null)
    setSearchQuery('')
  }

  const hasActiveFilters = selectedInterestId !== null || selectedAreaId !== null || searchQuery.trim() !== ''

  const handleConfirmDelete = async () => {
    if (deleteModal.idea) await remove(deleteModal.idea.id)
    setDeleteModal({ isOpen: false, idea: null })
  }

  // Mobile chip list of interests
  const sortedInterests = useMemo(
    () => [...interests].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [interests]
  )

  const mobileAreaChips = useMemo(
    () =>
      selectedInterestId
        ? areas
            .filter((a) => a.interestId === selectedInterestId)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        : [],
    [areas, selectedInterestId]
  )

  return (
    <div className="h-full bg-surface-950 flex flex-col overflow-hidden">

      {/* ── Top Header ───────────────────────────────────────────────────── */}
      <div className="flex-none px-4 pt-5 pb-4 md:px-6 border-b border-zinc-800/60">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">Ideias</h1>
            <span className="text-sm text-zinc-500 tabular-nums">{filteredDocuments.length} de {documents.length}</span>
          </div>
          <button
            onClick={() => navigate('/ideia/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors shadow-lg shadow-accent/20 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden xs:inline">Nova ideia</span>
            <span className="xs:hidden">Nova</span>
          </button>
        </div>

        {/* Search + Controls row */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar ideias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-surface-800 border border-zinc-700/50 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/15 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative hidden sm:block">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 pl-3 pr-8 rounded-xl bg-surface-800 border border-zinc-700/50 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 appearance-none cursor-pointer transition-colors hover:border-zinc-600"
            >
              <option value="newest">Mais recente</option>
              <option value="oldest">Mais antigo</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-xl border border-zinc-700/50 bg-surface-800 p-1 gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Grade"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Lista"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Mobile filter button */}
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            className={`md:hidden flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm transition-colors ${
              selectedInterestId || selectedAreaId
                ? 'border-accent/50 bg-accent/10 text-accent'
                : 'border-zinc-700/50 bg-surface-800 text-zinc-400'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filtrar
            {(selectedInterestId || selectedAreaId) && (
              <span className="w-4 h-4 rounded-full bg-accent text-white text-xs flex items-center justify-center font-bold">
                {(selectedInterestId ? 1 : 0) + (selectedAreaId ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Mobile interest chips */}
        {sortedInterests.length > 0 && (
          <div className="md:hidden mt-3 -mx-4 px-4 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 pb-1 min-w-max">
              <button
                type="button"
                onClick={() => handleSelectInterest(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedInterestId === null
                    ? 'bg-accent text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Todas
              </button>
              {sortedInterests.map((interest) => {
                const color = interestColorMap.get(interest.id) ?? '#7c8aff'
                const isSelected = selectedInterestId === interest.id
                return (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => handleSelectInterest(isSelected ? null : interest.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isSelected
                        ? 'text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                    style={isSelected ? { backgroundColor: color } : {}}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.6)' : color }}
                    />
                    {interest.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Mobile area chips (when interest selected) */}
        {selectedInterestId && mobileAreaChips.length > 0 && (
          <div className="md:hidden mt-2 -mx-4 px-4 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 pb-1 min-w-max">
              <button
                type="button"
                onClick={() => setSelectedAreaId(null)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors ${
                  selectedAreaId === null
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Todas áreas
              </button>
              {mobileAreaChips.map((area) => {
                const isSelected = selectedAreaId === area.id
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setSelectedAreaId(isSelected ? null : area.id)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors ${
                      isSelected
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {area.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {selectedInterest && (
              <span
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
                style={{
                  borderColor: `${interestColorMap.get(selectedInterest.id)}40`,
                  backgroundColor: `${interestColorMap.get(selectedInterest.id)}15`,
                  color: interestColorMap.get(selectedInterest.id),
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: interestColorMap.get(selectedInterest.id) }}
                />
                {selectedInterest.name}
                <button onClick={() => handleSelectInterest(null)} className="opacity-60 hover:opacity-100">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {selectedArea && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {selectedArea.name}
                <button onClick={() => setSelectedAreaId(null)} className="opacity-60 hover:opacity-100">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="opacity-60 hover:opacity-100">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Desktop Filter Sidebar */}
        <div className="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-zinc-800/60 overflow-y-auto p-3">
          <FilterPanel
            interests={interests}
            areas={areas}
            selectedInterestId={selectedInterestId}
            selectedAreaId={selectedAreaId}
            documents={documents}
            onSelectInterest={handleSelectInterest}
            onSelectArea={setSelectedAreaId}
            interestColorMap={interestColorMap}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-zinc-300 font-semibold mb-1.5">
                {hasActiveFilters ? 'Nenhuma ideia encontrada' : 'Sem ideias ainda'}
              </h3>
              <p className="text-zinc-500 text-sm max-w-xs mb-5">
                {hasActiveFilters
                  ? 'Tente ajustar os filtros ou buscar por outro termo.'
                  : 'Comece criando sua primeira ideia para organizar seus pensamentos.'}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                >
                  Limpar filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/ideia/new')}
                  className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-bright transition-colors"
                >
                  Criar primeira ideia
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-4 md:p-5">
              {/* Sort on mobile */}
              <div className="sm:hidden flex items-center justify-between mb-4">
                <span className="text-xs text-zinc-500">{filteredDocuments.length} ideia{filteredDocuments.length !== 1 ? 's' : ''}</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-8 pl-2 pr-6 rounded-lg bg-surface-800 border border-zinc-700/50 text-xs text-zinc-300 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="newest">Mais recente</option>
                  <option value="oldest">Mais antigo</option>
                  <option value="az">A → Z</option>
                  <option value="za">Z → A</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                {filteredDocuments.map((doc) => (
                  <IdeaCard
                    key={doc.id}
                    document={doc}
                    color={getColorForDoc(doc)}
                    onEdit={(id) => navigate(`/ideia/${id}`)}
                    onDelete={(d) => setDeleteModal({ isOpen: true, idea: d })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 md:p-5">
              {/* Sort on mobile */}
              <div className="sm:hidden flex items-center justify-between mb-4">
                <span className="text-xs text-zinc-500">{filteredDocuments.length} ideia{filteredDocuments.length !== 1 ? 's' : ''}</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-8 pl-2 pr-6 rounded-lg bg-surface-800 border border-zinc-700/50 text-xs text-zinc-300 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="newest">Mais recente</option>
                  <option value="oldest">Mais antigo</option>
                  <option value="az">A → Z</option>
                  <option value="za">Z → A</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                {filteredDocuments.map((doc) => (
                  <IdeaListItem
                    key={doc.id}
                    document={doc}
                    color={getColorForDoc(doc)}
                    onEdit={(id) => navigate(`/ideia/${id}`)}
                    onDelete={(d) => setDeleteModal({ isOpen: true, idea: d })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Filter Sheet ───────────────────────────────────────────── */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileFilterOpen(false)}
          />
          <div className="relative bg-surface-900 rounded-t-2xl border-t border-zinc-800 max-h-[80vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-100">Filtros</h2>
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-accent hover:text-accent-bright transition-colors"
                  >
                    Limpar tudo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-3 flex-1">
              <FilterPanel
                interests={interests}
                areas={areas}
                selectedInterestId={selectedInterestId}
                selectedAreaId={selectedAreaId}
                documents={documents}
                onSelectInterest={handleSelectInterest}
                onSelectArea={setSelectedAreaId}
                interestColorMap={interestColorMap}
              />
            </div>
            <div className="p-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors"
              >
                Ver {filteredDocuments.length} ideia{filteredDocuments.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteModal.isOpen}
        idea={deleteModal.idea}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, idea: null })}
      />
    </div>
  )
}
