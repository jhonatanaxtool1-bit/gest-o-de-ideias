import { useState } from 'react'
import type { Interest, Area } from '@/modules/organization/types'

interface GraphControlsProps {
  interests: Interest[]
  areas: Area[]
  selectedInterest: string | null
  selectedArea: string | null
  showRelations: boolean
  onInterestChange: (interestId: string | null) => void
  onAreaChange: (areaId: string | null) => void
  onToggleRelations: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onClearFilters: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function GraphControls({
  interests,
  areas,
  selectedInterest,
  selectedArea,
  showRelations,
  onInterestChange,
  onAreaChange,
  onToggleRelations,
  onExpandAll,
  onCollapseAll,
  onClearFilters,
  searchQuery,
  onSearchChange,
}: GraphControlsProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const filteredAreas = selectedInterest
    ? areas.filter((a) => a.interestId === selectedInterest)
    : areas

  return (
    <div className="
      absolute top-4 left-4 right-4 z-10
      flex items-center gap-3
      p-3 rounded-xl
      bg-surface-900/90 backdrop-blur-md
      border border-zinc-800
      shadow-lg shadow-black/20
    ">
      <div className={`
        flex-1 max-w-md relative
        transition-all duration-200
        ${isSearchFocused ? 'ring-2 ring-accent/30 rounded-lg' : ''}
      `}>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Buscar documentos..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          className="
            w-full h-9 pl-9 pr-3 rounded-lg
            bg-zinc-800/50 border border-zinc-700/50
            text-zinc-200 text-sm placeholder:text-zinc-500
            focus:outline-none focus:border-zinc-600
            transition-colors
          "
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="h-6 w-px bg-zinc-700 mx-1" />

      <select
        value={selectedInterest || ''}
        onChange={(e) => onInterestChange(e.target.value || null)}
        className="
          h-9 px-3 rounded-lg
          bg-zinc-800/50 border border-zinc-700/50
          text-zinc-300 text-sm
          focus:outline-none focus:border-zinc-600
          cursor-pointer
          min-w-[140px]
        "
      >
        <option value="">Todos interesses</option>
        {interests.map((i) => (
          <option key={i.id} value={i.id}>{i.name}</option>
        ))}
      </select>

      <select
        value={selectedArea || ''}
        onChange={(e) => onAreaChange(e.target.value || null)}
        disabled={!selectedInterest}
        className="
          h-9 px-3 rounded-lg
          bg-zinc-800/50 border border-zinc-700/50
          text-zinc-300 text-sm
          focus:outline-none focus:border-zinc-600
          cursor-pointer disabled:cursor-not-allowed
          disabled:opacity-50 disabled:text-zinc-500
          min-w-[140px]
        "
      >
        <option value="">Todas áreas</option>
        {filteredAreas.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      <div className="h-6 w-px bg-zinc-700 mx-1" />

      <button
        onClick={onToggleRelations}
        className={`
          h-9 px-3 rounded-lg flex items-center gap-2
          text-sm font-medium
          transition-colors
          ${showRelations
            ? 'bg-accent/20 text-accent border border-accent/30'
            : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-300'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span>Relações</span>
      </button>

      <button
        onClick={onExpandAll}
        className="
          h-9 px-3 rounded-lg flex items-center gap-2
          bg-zinc-800/50 border border-zinc-700/50
          text-zinc-400 text-sm
          hover:text-zinc-300 hover:bg-zinc-700/50
          transition-colors
        "
        title="Expandir tudo"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      <button
        onClick={onCollapseAll}
        className="
          h-9 px-3 rounded-lg flex items-center gap-2
          bg-zinc-800/50 border border-zinc-700/50
          text-zinc-400 text-sm
          hover:text-zinc-300 hover:bg-zinc-700/50
          transition-colors
        "
        title="Recolher tudo"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </button>

      {(selectedInterest || selectedArea || searchQuery) && (
        <button
          onClick={onClearFilters}
          className="
            h-9 px-3 rounded-lg flex items-center gap-2
            bg-zinc-800/50 border border-zinc-700/50
            text-zinc-400 text-sm
            hover:text-zinc-300 hover:bg-zinc-700/50
            transition-colors
          "
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Limpar</span>
        </button>
      )}
    </div>
  )
}
