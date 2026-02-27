import { FormEvent, useMemo, useState } from 'react'
import { useOrganization } from '@/modules/organization/useOrganization'
import { useDocuments } from '@/modules/documents/useDocuments'
import type { Area, Interest } from '@/modules/organization/types'

interface DeleteModalProps {
  isOpen: boolean
  title: string
  message: string
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteModal({ isOpen, title, message, itemName, onConfirm, onCancel }: DeleteModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-surface-900 p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>

        <h3 className="mb-2 text-lg font-semibold text-zinc-100">{title}</h3>
        <p className="mb-2 text-sm text-zinc-400">{message}</p>
        <p className="mb-6 rounded-lg bg-zinc-800/50 px-3 py-2 text-sm font-medium text-zinc-300">
          {itemName}
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

export function OrganizationPage() {
  const {
    interests,
    areas,
    areasByInterestId,
    addInterest,
    addArea,
    removeInterest,
    removeArea,
    editInterest,
    editArea,
  } = useOrganization()
  const { create: createDocument } = useDocuments()

  const [newInterest, setNewInterest] = useState('')
  const [selectedInterestId, setSelectedInterestId] = useState('')
  const [newArea, setNewArea] = useState('')

  const [interestIdAddingArea, setInterestIdAddingArea] = useState<string | null>(null)
  const [newAreaNameInline, setNewAreaNameInline] = useState('')

  const [editingInterest, setEditingInterest] = useState<string | null>(null)
  const [editingInterestName, setEditingInterestName] = useState('')
  const [editingArea, setEditingArea] = useState<string | null>(null)
  const [editingAreaName, setEditingAreaName] = useState('')

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    type: 'interest' | 'area'
    item: Interest | Area | null
    cascadeCount: number
  }>({
    isOpen: false,
    type: 'interest',
    item: null,
    cascadeCount: 0,
  })

  const grouped = useMemo(() => {
    return interests.map((interest) => ({
      ...interest,
      areas: areasByInterestId.get(interest.id) ?? [],
    }))
  }, [interests, areasByInterestId])

  const handleInterestSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const created = await addInterest(newInterest)
    if (created) {
      setNewInterest('')
      if (!selectedInterestId) setSelectedInterestId(created.id)
    }
  }

  const handleAreaSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedInterestId) return
    const created = await addArea(newArea, selectedInterestId)
    if (created) setNewArea('')
  }

  const handleInlineAreaSubmit = async (e: FormEvent<HTMLFormElement>, interestId: string) => {
    e.preventDefault()
    const created = await addArea(newAreaNameInline, interestId)
    if (created) {
      setNewAreaNameInline('')
      setInterestIdAddingArea(null)
    }
  }

  const handleCreateIdea = async (area: Area) => {
    const interest = interests.find((i) => i.id === area.interestId)
    if (!interest) return
    await createDocument({
      title: 'Nova ideia',
      interest: interest.name,
      area: area.name,
      content: '',
      cover: '',
      tags: [],
      relations: [],
    })
  }

  const handleDeleteInterest = (interest: Interest) => {
    const interestAreas = areasByInterestId.get(interest.id) ?? []
    setDeleteModal({
      isOpen: true,
      type: 'interest',
      item: interest,
      cascadeCount: interestAreas.length,
    })
  }

  const handleDeleteArea = (area: Area) => {
    setDeleteModal({
      isOpen: true,
      type: 'area',
      item: area,
      cascadeCount: 0,
    })
  }

  const confirmDelete = async () => {
    if (!deleteModal.item) return
    if (deleteModal.type === 'interest') {
      await removeInterest(deleteModal.item.id)
    } else {
      await removeArea(deleteModal.item.id)
    }
    setDeleteModal({ isOpen: false, type: 'interest', item: null, cascadeCount: 0 })
  }

  const startEditingInterest = (interest: Interest) => {
    setEditingInterest(interest.id)
    setEditingInterestName(interest.name)
  }

  const saveEditingInterest = async () => {
    if (editingInterest) {
      await editInterest(editingInterest, editingInterestName)
    }
    setEditingInterest(null)
    setEditingInterestName('')
  }

  const cancelEditingInterest = () => {
    setEditingInterest(null)
    setEditingInterestName('')
  }

  const startEditingArea = (area: Area) => {
    setEditingArea(area.id)
    setEditingAreaName(area.name)
  }

  const saveEditingArea = async () => {
    if (editingArea) {
      await editArea(editingArea, editingAreaName)
    }
    setEditingArea(null)
    setEditingAreaName('')
  }

  const cancelEditingArea = () => {
    setEditingArea(null)
    setEditingAreaName('')
  }

  const deleteModalMessage =
    deleteModal.type === 'interest'
      ? deleteModal.cascadeCount > 0
        ? `Esta ação excluirá permanentemente o interesse e todas as suas ${deleteModal.cascadeCount} áreas. Esta ação não pode ser desfeita.`
        : 'Esta ação excluirá permanentemente o interesse. Esta ação não pode ser desfeita.'
      : 'Esta ação excluirá permanentemente a área. Esta ação não pode ser desfeita.'

  return (
    <div className="h-full overflow-auto bg-surface-950">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-semibold text-zinc-100">Interesses e Áreas</h1>
          <p className="text-sm text-zinc-500">Gerencie a hierarquia: Interesse {'>'} Área {'>'} Documento/Ideia</p>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-zinc-800 bg-surface-900/40 p-5">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">Cadastrar Interesse</h2>
            <form onSubmit={handleInterestSubmit} className="flex gap-2">
              <input
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                placeholder="Nome do interesse"
                className="h-11 flex-1 rounded-lg border border-zinc-700 bg-transparent px-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newInterest.trim()}
                className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Adicionar
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-surface-900/40 p-5">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">Cadastrar Área</h2>
            <form onSubmit={handleAreaSubmit} className="space-y-3">
              <select
                value={selectedInterestId}
                onChange={(e) => setSelectedInterestId(e.target.value)}
                className="h-11 w-full rounded-lg border border-zinc-700 bg-surface-950 px-3 text-sm text-zinc-200 focus:border-accent focus:outline-none"
              >
                <option value="">Selecione o interesse pai</option>
                {interests.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  placeholder="Nome da área"
                  className="h-11 flex-1 rounded-lg border border-zinc-700 bg-transparent px-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newArea.trim() || !selectedInterestId}
                  className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </section>
        </div>

        <section className="rounded-xl border border-zinc-800 bg-surface-900/30 p-6">
          <h2 className="mb-6 text-sm font-medium uppercase tracking-wide text-zinc-400">Interesses Cadastrados</h2>

          {grouped.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/50 mx-auto">
                <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-zinc-500">Nenhum interesse cadastrado</p>
              <p className="mt-1 text-sm text-zinc-600">Crie um interesse para começar</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((interest) => (
                <div
                  key={interest.id}
                  className="rounded-xl border border-zinc-800 bg-surface-900/60 overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 bg-surface-900 px-5 py-4">
                    {editingInterest === interest.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          value={editingInterestName}
                          onChange={(e) => setEditingInterestName(e.target.value)}
                          className="h-10 flex-1 rounded-lg border border-zinc-600 bg-surface-800 px-3 text-sm text-zinc-200 focus:border-accent focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={saveEditingInterest}
                          className="rounded-lg bg-accent p-2 text-white hover:bg-accent-bright transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingInterest}
                          className="rounded-lg border border-zinc-600 p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700">
                            <svg className="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-zinc-200">{interest.name}</h3>
                            <p className="text-xs text-zinc-500">
                              {interest.areas.length} {interest.areas.length === 1 ? 'área' : 'áreas'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setInterestIdAddingArea(interest.id)
                              setNewAreaNameInline('')
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                            title="Registrar área neste interesse"
                          >
                            Registrar área
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingInterest(interest)}
                            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                            title="Editar"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInterest(interest)}
                            className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            title="Excluir"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="p-5">
                    {interestIdAddingArea === interest.id && (
                      <form
                        onSubmit={(e) => handleInlineAreaSubmit(e, interest.id)}
                        className="mb-4 flex gap-2 rounded-lg border border-zinc-700 bg-surface-800/50 p-3"
                      >
                        <input
                          value={newAreaNameInline}
                          onChange={(e) => setNewAreaNameInline(e.target.value)}
                          placeholder="Nome da nova área"
                          className="h-9 flex-1 rounded-lg border border-zinc-600 bg-surface-800 px-3 text-sm text-zinc-200 placeholder-zinc-500 focus:border-accent focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={!newAreaNameInline.trim()}
                          className="h-9 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Adicionar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInterestIdAddingArea(null)
                            setNewAreaNameInline('')
                          }}
                          className="h-9 rounded-lg border border-zinc-600 px-3 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          Cancelar
                        </button>
                      </form>
                    )}
                    {interest.areas.length === 0 && interestIdAddingArea !== interest.id && (
                      <div className="rounded-lg border border-dashed border-zinc-700 py-8 text-center">
                        <p className="text-sm text-zinc-500">Nenhuma área cadastrada neste interesse</p>
                        <p className="mt-1 text-xs text-zinc-600">Clique em &quot;Registrar área&quot; ou use o formulário acima</p>
                      </div>
                    )}
                    {interest.areas.length > 0 && (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-zinc-800">
                            <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                              Nome da Área
                            </th>
                            <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {interest.areas.map((area) => (
                            <tr key={area.id} className="group">
                              <td className="py-3">
                                {editingArea === area.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={editingAreaName}
                                      onChange={(e) => setEditingAreaName(e.target.value)}
                                      className="h-9 flex-1 rounded-lg border border-zinc-600 bg-surface-800 px-3 text-sm text-zinc-200 focus:border-accent focus:outline-none"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={saveEditingArea}
                                      className="rounded-lg bg-accent p-1.5 text-white hover:bg-accent-bright transition-colors"
                                    >
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditingArea}
                                      className="rounded-lg border border-zinc-600 p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                                    >
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-accent/60" />
                                    <span className="text-sm font-medium text-zinc-300">{area.name}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 text-right">
                                {editingArea !== area.id && (
                                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => handleCreateIdea(area)}
                                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                                      title="Criar ideia com nome padrão (editar depois)"
                                    >
                                      Criar ideia
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEditingArea(area)}
                                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                                      title="Editar"
                                    >
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteArea(area)}
                                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                      title="Excluir"
                                    >
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <DeleteModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.type === 'interest' ? 'Excluir Interesse' : 'Excluir Área'}
        message={deleteModalMessage}
        itemName={deleteModal.item?.name ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, type: 'interest', item: null, cascadeCount: 0 })}
      />
    </div>
  )
}
