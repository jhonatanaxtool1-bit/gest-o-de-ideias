import { useEffect, useMemo, useState } from 'react'
import type { PlanningCard, PlanningPriority, PlanningStatus } from '@/modules/professionalPlanning/types'

type CardModalMode = 'create' | 'edit'

interface CardModalSubmitPayload {
  title: string
  status: PlanningStatus
  priority: PlanningPriority
}

interface CardModalProps {
  isOpen: boolean
  mode: CardModalMode
  initialCard?: PlanningCard
  defaultStatus: PlanningStatus
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: CardModalSubmitPayload) => Promise<void>
}

const statusOptions: Array<{ value: PlanningStatus; label: string }> = [
  { value: 'nostatus', label: 'Backlog' },
  { value: 'todo', label: 'A fazer' },
  { value: 'doing', label: 'Em andamento' },
  { value: 'done', label: 'Concluído' },
]

const priorityOptions: Array<{ value: PlanningPriority; label: string }> = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
]

export function CardModal({
  isOpen,
  mode,
  initialCard,
  defaultStatus,
  isSaving,
  onClose,
  onSubmit,
}: CardModalProps) {
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<PlanningStatus>(defaultStatus)
  const [priority, setPriority] = useState<PlanningPriority | ''>('')
  const [error, setError] = useState<string | null>(null)

  const titleText = useMemo(() => (mode === 'create' ? 'Novo card' : 'Editar card'), [mode])

  useEffect(() => {
    if (!isOpen) return
    setTitle(initialCard?.title ?? '')
    setStatus(initialCard?.status ?? defaultStatus)
    setPriority(initialCard?.priority ?? '')
    setError(null)
  }, [isOpen, initialCard, defaultStatus])

  if (!isOpen) return null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError('Informe o título do card.')
      return
    }
    if (!priority) {
      setError('Selecione a prioridade.')
      return
    }
    setError(null)
    await onSubmit({
      title: cleanTitle,
      status,
      priority,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">{titleText}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Título</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 transition-colors focus:border-zinc-500"
              placeholder="Ex: Preparar reunião com cliente"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as PlanningStatus)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-500"
            >
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Prioridade</label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as PlanningPriority)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-500"
            >
              <option value="">Selecione uma prioridade</option>
              {priorityOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : mode === 'create' ? 'Criar card' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
