import { useEffect, useMemo, useState } from 'react'
import { CardModal } from '@/components/professionalPlanning/CardModal'
import { useProfessionalPlanning } from '@/modules/professionalPlanning/useProfessionalPlanning'
import type { PlanningCard, PlanningPriority, PlanningStatus } from '@/modules/professionalPlanning/types'

type KanbanTone = 'neutral' | 'green' | 'amber'

type KanbanColumn = {
  id: PlanningStatus
  title: string
  tone: KanbanTone
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'todo', title: 'A fazer', tone: 'neutral' },
  { id: 'doing', title: 'Em andamento', tone: 'amber' },
  { id: 'done', title: 'Concluído', tone: 'green' },
]

const toneClasses: Record<KanbanTone, string> = {
  neutral: 'bg-zinc-800/70 text-zinc-300',
  green: 'bg-emerald-500/20 text-emerald-300',
  amber: 'bg-amber-500/20 text-amber-300',
}

const priorityLabel: Record<PlanningPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

const priorityClass: Record<PlanningPriority, string> = {
  low: 'bg-zinc-800/80 text-zinc-300 border-zinc-700',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  high: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
}

export function ProfessionalPlanningPage() {
  const {
    cardsByStatus,
    finalizedCards,
    isLoading,
    isSaving,
    error,
    loadCards,
    createCard,
    editCard,
    removeCard,
    finalizeCard,
    reopenCard,
  } = useProfessionalPlanning()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [activeCard, setActiveCard] = useState<PlanningCard | undefined>(undefined)
  const [selectedStatus, setSelectedStatus] = useState<PlanningStatus>('todo')
  const [dragOverColumn, setDragOverColumn] = useState<PlanningStatus | null>(null)
  const [activeTab, setActiveTab] = useState<'backlog' | 'kanban' | 'finalized'>('kanban')

  useEffect(() => {
    loadCards()
  }, [loadCards])

  const orderedColumns = useMemo(
    () =>
      KANBAN_COLUMNS.map((column) => ({
        ...column,
        cards: cardsByStatus[column.id],
      })),
    [cardsByStatus]
  )

  const backlogCards = cardsByStatus.nostatus ?? []

  const cardsById = useMemo(() => {
    const map = new Map<string, PlanningCard>()
    for (const column of orderedColumns) {
      for (const card of column.cards) {
        map.set(card.id, card)
      }
    }
    return map
  }, [orderedColumns])

  function openCreateModal(status: PlanningStatus) {
    setModalMode('create')
    setSelectedStatus(status)
    setActiveCard(undefined)
    setModalOpen(true)
  }

  function openEditModal(card: PlanningCard) {
    setModalMode('edit')
    setSelectedStatus(card.status)
    setActiveCard(card)
    setModalOpen(true)
  }

  async function handleDelete(card: PlanningCard) {
    const confirmed = window.confirm(`Deseja excluir o card "${card.title}"?`)
    if (!confirmed) return
    await removeCard(card.id)
  }

  async function handleMoveStatus(card: PlanningCard, status: PlanningStatus) {
    if (card.status === status) return
    await editCard(card.id, { status })
  }

  async function handleFinalize(card: PlanningCard) {
    await finalizeCard(card.id)
  }

  async function handleReopen(card: PlanningCard) {
    await reopenCard(card.id)
  }

  function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Sem data'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Sem data'
    return date.toLocaleString('pt-BR')
  }

  function handleDragStart(event: React.DragEvent<HTMLDivElement>, cardId: string) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', cardId)
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>, status: PlanningStatus) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragOverColumn !== status) setDragOverColumn(status)
  }

  function handleDragLeave() {
    setDragOverColumn(null)
  }

  async function handleDrop(event: React.DragEvent<HTMLElement>, status: PlanningStatus) {
    event.preventDefault()
    const cardId = event.dataTransfer.getData('text/plain')
    setDragOverColumn(null)
    if (!cardId) return
    const card = cardsById.get(cardId)
    if (!card) return
    await handleMoveStatus(card, status)
  }

  async function handleModalSubmit(payload: {
    title: string
    status: PlanningStatus
    priority: PlanningPriority
  }) {
    if (modalMode === 'create') {
      const created = await createCard(payload)
      if (created) setModalOpen(false)
      return
    }
    if (!activeCard) return
    const updated = await editCard(activeCard.id, payload)
    if (updated) setModalOpen(false)
  }

  return (
    <div className="min-h-full bg-[#191919]">
      <div className="mx-auto max-w-[1400px] px-8 py-10">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Task management</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Planejamento Empresarial</h1>
        </header>

        <div className="mb-5 flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('backlog')}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              activeTab === 'backlog' ? 'bg-accent/20 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            Backlog
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kanban')}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              activeTab === 'kanban' ? 'bg-accent/20 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('finalized')}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              activeTab === 'finalized'
                ? 'bg-accent/20 text-accent'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            Finalizado
          </button>
        </div>

        {activeTab === 'backlog' ? (
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => openCreateModal('nostatus')}
              className="w-full rounded-lg border border-dashed border-zinc-700/90 px-4 py-3 text-left text-sm text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
            >
              + New item
            </button>
            {backlogCards.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum item no backlog.</p>
            ) : (
              backlogCards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-zinc-200 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{card.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] ${priorityClass[card.priority]}`}
                        >
                          Prioridade {priorityLabel[card.priority]}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(card)}
                        className="rounded-md border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStatus(card, 'todo')}
                        className="rounded-md border border-accent/50 bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent transition-colors hover:bg-accent/30"
                      >
                        Mover para Kanban
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(card)}
                        className="rounded-md border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        ) : activeTab === 'kanban' ? (
          <section className="overflow-x-auto pb-4">
            <div className="grid min-w-[740px] grid-cols-3 gap-4">
              {orderedColumns.map((column) => (
                <article
                  key={column.id}
                  onDragOver={(event) => handleDragOver(event, column.id)}
                  onDrop={(event) => handleDrop(event, column.id)}
                  onDragLeave={handleDragLeave}
                  className={`rounded-xl border bg-zinc-900/80 p-3 transition-colors ${
                    dragOverColumn === column.id ? 'border-accent/70' : 'border-zinc-800/80'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClasses[column.tone]}`}>
                      {column.title}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {column.cards.map((card) => (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(event) => handleDragStart(event, card.id)}
                        className="cursor-grab rounded-lg border border-zinc-800 bg-[#222222] px-3 py-2 text-sm text-zinc-200 shadow-sm active:cursor-grabbing"
                      >
                        <p>{card.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[10px] ${priorityClass[card.priority]}`}
                          >
                            Prioridade {priorityLabel[card.priority]}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(card)}
                            className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(card)}
                            className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
                          >
                            Excluir
                          </button>
                          {column.id === 'done' ? (
                            <button
                              type="button"
                              onClick={() => handleFinalize(card)}
                              className="rounded-md border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30"
                            >
                              Finalizar
                            </button>
                          ) : (
                            <span className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300">
                              Arraste para mover
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => openCreateModal(column.id)}
                      className="w-full rounded-lg border border-dashed border-zinc-700/90 px-3 py-2 text-left text-sm text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
                    >
                      + New item
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            {finalizedCards.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma tarefa finalizada ainda.</p>
            ) : (
              finalizedCards.map((card, index) => (
                <article
                  key={card.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-zinc-200 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{card.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">Finalizada em {formatDateTime(card.completedAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {index === 0 ? (
                        <span className="rounded-md border border-indigo-500/40 bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300">
                          Mais recente
                        </span>
                      ) : null}
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] ${priorityClass[card.priority]}`}>
                        Prioridade {priorityLabel[card.priority]}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleReopen(card)}
                        className="rounded-md border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        Reabrir
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        )}

        {isLoading ? <p className="mt-3 text-sm text-zinc-400">Carregando cards...</p> : null}
        {!isLoading && error ? (
          <div className="mt-3 flex items-center gap-3">
            <p className="text-sm text-rose-300">{error}</p>
            <button
              type="button"
              onClick={loadCards}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}
      </div>

      <CardModal
        isOpen={modalOpen}
        mode={modalMode}
        defaultStatus={selectedStatus}
        initialCard={activeCard}
        isSaving={isSaving}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
    </div>
  )
}
