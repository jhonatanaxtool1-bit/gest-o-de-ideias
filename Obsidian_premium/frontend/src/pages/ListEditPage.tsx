import { FormEvent, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLists } from '@/modules/lists/useLists'
import type { List, ListItem } from '@/modules/lists/types'

export function ListEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lists, isLoaded, getById, toggleItemDone, addItem, updateItemLabel, removeItem } = useLists()
  const [list, setList] = useState<List | null>(null)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const found = lists.find((l) => l.id === id)
    if (found) {
      setList(found)
      return
    }
    getById(id).then((l) => setList(l ?? null))
  }, [id, lists, getById])

  useEffect(() => {
    if (editingItemId && list) {
      const item = list.items.find((i) => i.id === editingItemId)
      setEditingLabel(item?.label ?? '')
    } else {
      setEditingLabel('')
    }
  }, [editingItemId, list])

  const handleToggle = async (item: ListItem) => {
    if (!list) return
    await toggleItemDone(list.id, item.id, !item.done)
    setList((prev) => {
      if (!prev || prev.id !== list.id) return prev
      return {
        ...prev,
        items: prev.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)),
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const handleAddItem = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!list || !newItemLabel.trim()) return
    setError(null)
    try {
      const added = await addItem(list.id, newItemLabel.trim())
      if (added) {
        setList((prev) => {
          if (!prev || prev.id !== list.id) return prev
          return { ...prev, items: [...prev.items, added], updatedAt: new Date().toISOString() }
        })
        setNewItemLabel('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar item.')
    }
  }

  const handleStartEdit = (item: ListItem) => {
    setEditingItemId(item.id)
    setEditingLabel(item.label)
  }

  const handleSaveEdit = async () => {
    if (!list || !editingItemId) return
    await updateItemLabel(list.id, editingItemId, editingLabel.trim())
    setList((prev) => {
      if (!prev || prev.id !== list.id) return prev
      return {
        ...prev,
        items: prev.items.map((i) => (i.id === editingItemId ? { ...i, label: editingLabel.trim() } : i)),
        updatedAt: new Date().toISOString(),
      }
    })
    setEditingItemId(null)
  }

  const handleRemoveItem = async (item: ListItem) => {
    if (!list) return
    await removeItem(list.id, item.id)
    setList((prev) => {
      if (!prev || prev.id !== list.id) return prev
      return {
        ...prev,
        items: prev.items.filter((i) => i.id !== item.id),
        updatedAt: new Date().toISOString(),
      }
    })
  }

  if (!id) {
    navigate('/listas')
    return null
  }

  if (!isLoaded && !list) {
    return (
      <div className="min-h-full bg-surface-950 flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Carregando…</p>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="min-h-full bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-sm mb-4">Lista não encontrada.</p>
          <button
            type="button"
            onClick={() => navigate('/listas')}
            className="rounded-lg bg-accent/20 text-accent px-4 py-2 text-sm font-medium hover:bg-accent/30"
          >
            Voltar às listas
          </button>
        </div>
      </div>
    )
  }

  const doneCount = list.items.filter((i) => i.done).length
  const totalCount = list.items.length

  return (
    <div className="min-h-full bg-surface-950 overflow-auto">
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/listas')}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            aria-label="Voltar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-zinc-100 truncate">{list.title}</h1>
            <p className="text-sm text-zinc-500">
              {list.listType} · {totalCount > 0 ? `${doneCount}/${totalCount} itens` : 'Nenhum item'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4 mb-6">
          <form onSubmit={handleAddItem} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              placeholder="Novo item..."
              className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
            >
              Adicionar
            </button>
          </form>
        </section>

        <section className="space-y-2">
          {list.items.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">Nenhum item na lista. Adicione acima.</p>
            </div>
          ) : (
            list.items.map((item) => (
              <article
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded border border-zinc-500 hover:border-zinc-400 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30"
                  aria-label={item.done ? 'Desmarcar' : 'Marcar como concluído'}
                >
                  {item.done && (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                {editingItemId === item.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') {
                          setEditingItemId(null)
                          setEditingLabel(item.label)
                        }
                      }}
                      autoFocus
                      className="flex-1 h-9 rounded-lg border border-zinc-600 bg-zinc-800 px-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white"
                    >
                      Salvar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(item)}
                    className={`flex-1 text-left text-sm truncate ${
                      item.done ? 'text-zinc-500 line-through' : 'text-zinc-200'
                    }`}
                  >
                    {item.label || '(sem texto)'}
                  </button>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {editingItemId !== item.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        aria-label="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item)}
                        className="rounded p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Remover"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
