import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLists } from '@/modules/lists/useLists'


export function ListNewPage() {
  const navigate = useNavigate()
  const { create } = useLists()
  const [title, setTitle] = useState('')
  const [initialItems, setInitialItems] = useState([{ id: Date.now(), label: '' }])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)


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
        .map((i) => i.label.trim())
        .filter(Boolean)
        .map((label) => ({ label }))
      const list = await create({ title: trimmedTitle, listType: 'geral', items })
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
            Defina o título e os primeiros itens da lista.
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
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Itens iniciais
            </label>
            <div className="flex flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
              {initialItems.map((item, idx) => (
                <div key={item.id} className="group flex items-center gap-3">
                  <div className="h-4 w-4 shrink-0 rounded border border-zinc-600 bg-zinc-800/50" />
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => {
                      const newItems = [...initialItems]
                      newItems[idx].label = e.target.value
                      setInitialItems(newItems)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const newItems = [...initialItems]
                        newItems.splice(idx + 1, 0, { id: Date.now() + Math.random(), label: '' })
                        setInitialItems(newItems)
                      } else if (e.key === 'Backspace' && item.label === '' && initialItems.length > 1) {
                        e.preventDefault()
                        let newItems = [...initialItems]
                        newItems.splice(idx, 1)
                        setInitialItems(newItems)
                      }
                    }}
                    placeholder={idx === 0 ? "Ex.: Leite" : "Adicionar item..."}
                    className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                    autoFocus={idx > 0 && idx === initialItems.length - 1 && item.label === ''}
                  />
                  {initialItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        let newItems = [...initialItems]
                        newItems.splice(idx, 1)
                        setInitialItems(newItems)
                      }}
                      className="text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setInitialItems([...initialItems, { id: Date.now(), label: '' }])}
              className="mt-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
            >
              + Adicionar item
            </button>
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
