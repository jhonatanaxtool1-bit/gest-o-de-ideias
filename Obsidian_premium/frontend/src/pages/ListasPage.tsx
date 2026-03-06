import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLists } from '@/modules/lists/useLists'
import type { List } from '@/modules/lists/types'

interface DeleteModalProps {
  isOpen: boolean
  list: List | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteModal({ isOpen, list, onConfirm, onCancel }: DeleteModalProps) {
  if (!isOpen || !list) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-surface-900 p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-zinc-100">Excluir lista</h3>
        <p className="mb-6 text-sm text-zinc-400">
          A lista &quot;{list.title}&quot; e todos os itens serão excluídos. Esta ação não pode ser desfeita.
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

export function ListasPage() {
  const navigate = useNavigate()
  const { lists, isLoaded, remove } = useLists()
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; list: List | null }>({ isOpen: false, list: null })

  const handleNewList = () => navigate('/lista/new')
  const handleEditList = (id: string) => navigate(`/lista/${id}`)
  const handleDeleteClick = (list: List) => setDeleteModal({ isOpen: true, list })
  const handleConfirmDelete = async () => {
    if (deleteModal.list) {
      await remove(deleteModal.list.id)
      setDeleteModal({ isOpen: false, list: null })
    }
  }
  const handleCancelDelete = () => setDeleteModal({ isOpen: false, list: null })

  return (
    <div className="min-h-full bg-surface-950 overflow-auto">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <header className="mb-6 md:mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Segundo Cérebro</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Listas</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Crie listas de qualquer tipo e use como checklist.
          </p>
        </header>

        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={handleNewList}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent-bright transition-colors shadow-lg shadow-accent/20"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova lista
          </button>
        </div>

        {!isLoaded ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-8 text-center text-zinc-400 text-sm">
            Carregando…
          </div>
        ) : lists.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-12 text-center">
            <p className="text-zinc-400 text-sm mb-4">Nenhuma lista criada.</p>
            <button
              type="button"
              onClick={handleNewList}
              className="rounded-lg bg-accent/20 text-accent px-4 py-2 text-sm font-medium hover:bg-accent/30 transition-colors"
            >
              Criar primeira lista
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map((list) => {
              const doneCount = list.items.filter((i) => i.done).length
              const totalCount = list.items.length
              return (
                <article
                  key={list.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-4 py-3 hover:border-zinc-700/80 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleEditList(list.id)}
                    className="flex min-w-0 flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-left w-full sm:w-auto"
                  >
                    <span className="text-zinc-200 font-medium truncate w-full sm:w-auto">{list.title}</span>
                    <span className="text-xs text-zinc-500 shrink-0">
                      {list.listType}
                    </span>
                    {totalCount > 0 && (
                      <span className="text-xs text-zinc-500 shrink-0">
                        {doneCount}/{totalCount} itens
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleEditList(list.id)}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(list)}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-red-400/90 hover:bg-red-500/10 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <DeleteModal
          isOpen={deleteModal.isOpen}
          list={deleteModal.list}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      </div>
    </div>
  )
}
