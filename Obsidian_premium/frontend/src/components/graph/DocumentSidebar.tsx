import { useNavigate } from 'react-router-dom'
import type { Document } from '@/modules/documents/types'
import type { Area, Interest } from '@/modules/organization/types'

interface DocumentSidebarProps {
  interests: Interest[]
  areas: Area[]
  documents: Document[]
  expandedInterests: Set<string>
  expandedAreas: Set<string>
  onToggleInterest: (id: string) => void
  onToggleArea: (id: string) => void
}

function generateGradient(id: string): string {
  const hues = [220, 260, 300, 340, 20, 60, 100, 160, 200]
  const hue1 = hues[id.charCodeAt(0) % hues.length]
  const hue2 = (hue1 + 40) % 360
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 50%))`
}

export function DocumentSidebar({
  interests,
  areas,
  documents,
  expandedInterests,
  expandedAreas,
  onToggleInterest,
  onToggleArea,
}: DocumentSidebarProps) {
  const navigate = useNavigate()

  const sortedInterests = [...interests].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const getAreasByInterest = (interestId: string) => {
    return areas
      .filter((a) => a.interestId === interestId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }

  const getDocumentsByArea = (areaName: string) => {
    return documents
      .filter((d) => d.area === areaName)
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  }

  const getDocCountByInterest = (interestId: string) => {
    const areaNames = areas.filter((a) => a.interestId === interestId).map((a) => a.name)
    return documents.filter((d) => areaNames.includes(d.area)).length
  }

  return (
    <div className="w-72 h-full bg-surface-900 border-l border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-zinc-200 font-semibold text-sm">Ideias por Interesse</h3>
        <p className="text-zinc-500 text-xs mt-1">{documents.length} documentos organizados</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {sortedInterests.map((interest) => {
          const interestAreas = getAreasByInterest(interest.id)
          const docCount = getDocCountByInterest(interest.id)
          const isExpanded = expandedInterests.has(interest.id)

          return (
            <div key={interest.id} className="mb-2">
              <button
                onClick={() => onToggleInterest(interest.id)}
                className="
                  w-full flex items-center justify-between
                  px-2 py-2 rounded-lg
                  hover:bg-zinc-800/60
                  transition-colors
                "
              >
                <span className="text-zinc-300 font-medium text-sm">{interest.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">{docCount}</span>
                  <svg
                    className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="ml-2 mt-1 space-y-1">
                  {interestAreas.map((area) => {
                    const areaDocs = getDocumentsByArea(area.name)
                    const isAreaExpanded = expandedAreas.has(area.id)

                    return (
                      <div key={area.id}>
                        <button
                          onClick={() => onToggleArea(area.id)}
                          className="
                            w-full flex items-center justify-between
                            px-2 py-1.5 rounded-lg
                            hover:bg-zinc-800/40
                            transition-colors
                          "
                        >
                          <span className="text-zinc-400 text-xs uppercase tracking-wider">
                            {area.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-600 text-xs">{areaDocs.length}</span>
                            <svg
                              className={`w-3.5 h-3.5 text-zinc-600 transition-transform duration-200 ${isAreaExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isAreaExpanded && (
                          <div className="ml-2 mt-1 space-y-0.5">
                            {areaDocs.map((doc) => (
                              <button
                                key={doc.id}
                                onClick={() => navigate(`/doc/${doc.id}`)}
                                className="
                                  w-full flex items-center gap-2
                                  px-2 py-1.5 rounded-lg
                                  hover:bg-zinc-800/60 hover:text-white
                                  text-zinc-400
                                  transition-colors
                                  group
                                "
                              >
                                <div
                                  className="w-6 h-6 rounded-md flex-shrink-0 bg-cover bg-center flex items-center justify-center"
                                  style={{
                                    backgroundImage: doc.cover
                                      ? `url(${doc.cover})`
                                      : generateGradient(doc.id),
                                  }}
                                >
                                  {!doc.cover && (
                                    <svg className="w-3 h-3 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  )}
                                </div>
                                <span className="text-xs truncate flex-1 text-left">{doc.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {interests.length === 0 && (
          <div className="text-center py-8">
            <p className="text-zinc-500 text-sm">Nenhum interesse criado</p>
            <p className="text-zinc-600 text-xs mt-1">Crie interesses em "Interesses e áreas"</p>
          </div>
        )}
      </div>
    </div>
  )
}
