import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLists } from '@/modules/lists/useLists'

const LIST_TYPES = ['geral', 'compras', 'tarefas', 'livros', 'projetos', 'outro']

export function ListNewPage() {
  const navigate = useNavigate()
  const { create } = useLists()
  const [title, setTitle] = useState('')
  const [listType, setListType] = useState('geral')
  const [customType, setCustomType] = useState('')
  const [initialItems, setInitialItems] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const effectiveType = listType === 'outro' ? customType.trim() || 'geral' : listType

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Digite um título para a lista.')
      return
    }
    setIsSubmitting(true)
    try {
      const items = initialItems
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((label) => ({ label }))
      const list = await create({ title: trimmedTitle, listType: effectiveType, items })
      if (list) navigate(`/lista/${list.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lista.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-surface-950 overflow-auto">
      <div className="max-w-xl mx-auto p-6">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Segundo Cérebro</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Criar lista</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Defina o título, o tipo e opcionalmente os primeiros itens.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-6">
          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Título
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Compras do mês"
              className="w-full h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tipo da lista</label>
            <div className="flex flex-wrap gap-2">
              {LIST_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setListType(type)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    listType === type
                      ? 'bg-accent text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            {listType === 'outro' && (
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Digite o tipo"
                className="mt-2 w-full h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
              />
            )}
          </div>

          <div>
            <label htmlFor="initialItems" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Itens iniciais (opcional, um por linha)
            </label>
            <textarea
              id="initialItems"
              value={initialItems}
              onChange={(e) => setInitialItems(e.target.value)}
              placeholder="Leite&#10;Pão&#10;Ovos"
              rows={5}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-2 focus:ring-accent/20 resize-y"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Criando…' : 'Criar lista'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/listas')}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
