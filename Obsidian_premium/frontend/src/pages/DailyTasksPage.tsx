import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  type DailyTask,
  createDailyTaskApi,
  deleteDailyTaskApi,
  fetchDailyTasksApi,
  updateDailyTaskApi,
} from '@/api/dailyTasksApi'

type TaskFilter = 'all' | 'pending' | 'done'

function createTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function DailyTasksPage() {
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDailyTasksApi()
      .then(setTasks)
      .catch(() => setTasks([]))
  }, [])

  const filteredTasks = useMemo(() => {
    if (filter === 'pending') return tasks.filter((task) => !task.done)
    if (filter === 'done') return tasks.filter((task) => task.done)
    return tasks
  }, [tasks, filter])

  const totalCount = tasks.length
  const doneCount = tasks.filter((task) => task.done).length
  const pendingCount = totalCount - doneCount

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const title = taskTitle.trim()
    if (!title) {
      setError('Digite o título da tarefa.')
      return
    }

    try {
      const created = await createDailyTaskApi({
        id: createTaskId(),
        title,
        done: false,
        createdAt: new Date().toISOString(),
      })
      setTasks((prev) => [created, ...prev])
      setTaskTitle('')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao criar tarefa.'
      setError(message)
    }
  }

  async function handleToggleTask(id: string) {
    const current = tasks.find((task) => task.id === id)
    if (!current) return
    const updated = await updateDailyTaskApi(id, { done: !current.done })
    setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)))
  }

  async function handleRemoveTask(id: string) {
    await deleteDailyTaskApi(id)
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }

  return (
    <div className="min-h-full bg-[#191919]">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Task management</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Tarefas Diarias</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Organize suas tarefas do dia com um fluxo simples.
          </p>
        </header>

        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleAddTask} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={taskTitle}
              onChange={(event) => {
                setTaskTitle(event.target.value)
                if (error) setError(null)
              }}
              placeholder="Nova tarefa..."
              className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
            >
              Adicionar
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                filter === 'all' ? 'bg-accent/20 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              Todas ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                filter === 'pending'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('done')}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                filter === 'done'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              Concluidas ({doneCount})
            </button>
          </div>
        </section>

        <section className="mt-5 space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">
                {tasks.length === 0 ? 'Nenhuma tarefa criada.' : 'Nenhuma tarefa nesse filtro.'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <article
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => handleToggleTask(task.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      task.done ? 'border-emerald-400 bg-emerald-400' : 'border-zinc-500'
                    }`}
                  />
                  <span
                    className={`truncate text-sm ${
                      task.done ? 'text-zinc-500 line-through' : 'text-zinc-200'
                    }`}
                  >
                    {task.title}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task.id)}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800"
                  >
                    {task.done ? 'Reabrir' : 'Concluir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveTask(task.id)}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
