import { FormEvent, useEffect, useState } from 'react'
import {
  type Reminder,
  type ReminderCreateInput,
  type ReminderRecurrence,
  RECURRENCE_LABELS,
  createReminderApi,
  deleteReminderApi,
  fetchRemindersApi,
} from '@/api/remindersApi'

function formatDue(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const RECURRENCE_OPTIONS: ReminderRecurrence[] = ['once', 'daily', 'every_2_days', 'weekly']

export function LembretesPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [firstDueAt, setFirstDueAt] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>('once')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRemindersApi()
      .then(setReminders)
      .catch(() => setReminders([]))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const t = title.trim()
    if (!t) {
      setError('Digite o título do lembrete.')
      return
    }
    const due = firstDueAt ? new Date(firstDueAt).toISOString() : new Date().toISOString()
    if (Number.isNaN(new Date(due).getTime())) {
      setError('Data/hora inválida.')
      return
    }
    try {
      const input: ReminderCreateInput = {
        title: t,
        body: body.trim() || undefined,
        firstDueAt: due,
        recurrence,
      }
      const created = await createReminderApi(input)
      setReminders((prev) => [created, ...prev])
      setTitle('')
      setBody('')
      const next = new Date()
      next.setMinutes(next.getMinutes() - next.getTimezoneOffset())
      setFirstDueAt(next.toISOString().slice(0, 16))
      setRecurrence('once')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lembrete.')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Excluir este lembrete?')) return
    try {
      await deleteReminderApi(id)
      setReminders((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.')
    }
  }

  return (
    <div className="min-h-full bg-[#191919]">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Lembretes</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Lembretes</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Registre lembretes para hoje ou com recorrência (diário, a cada 2 dias, semanal). O agente pode lançá-los para você.
          </p>
        </header>

        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="reminder-title" className="mb-1 block text-xs font-medium text-zinc-400">
                Título *
              </label>
              <input
                id="reminder-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="Ex.: Ligar para o médico"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label htmlFor="reminder-body" className="mb-1 block text-xs font-medium text-zinc-400">
                Descrição (opcional)
              </label>
              <textarea
                id="reminder-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Detalhes do lembrete"
                rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reminder-datetime" className="mb-1 block text-xs font-medium text-zinc-400">
                  Data e hora
                </label>
                <input
                  id="reminder-datetime"
                  type="datetime-local"
                  value={firstDueAt}
                  onChange={(e) => setFirstDueAt(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label htmlFor="reminder-recurrence" className="mb-1 block text-xs font-medium text-zinc-400">
                  Recorrência
                </label>
                <select
                  id="reminder-recurrence"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as ReminderRecurrence)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/20"
                >
                  {RECURRENCE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {RECURRENCE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
            >
              Criar lembrete
            </button>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Seus lembretes</h2>
          {loading ? (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-500">
              Carregando...
            </div>
          ) : reminders.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">Nenhum lembrete. Crie um acima.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {reminders.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-1 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-200">{r.title}</p>
                    {r.body && <p className="mt-0.5 text-xs text-zinc-500">{r.body}</p>}
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDue(r.firstDueAt)} · {RECURRENCE_LABELS[r.recurrence]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="mt-2 self-start rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 sm:mt-0"
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
