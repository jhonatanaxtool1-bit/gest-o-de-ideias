import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDocuments } from '@/modules/documents/useDocuments'
import { useOrganization } from '@/modules/organization/useOrganization'
import { RichTextEditor } from '@/components/IdeaRichTextEditor'
import type { DocumentCreate } from '@/modules/documents/types'
import { rewriteContentWithAi } from '@/modules/ai/openRouterService'

interface ImageModalProps {
  isOpen: boolean
  currentUrl: string
  onClose: () => void
  onSaveUrl: (url: string) => void
  onUpload: (file: File) => void
}

function ImageModal({ isOpen, currentUrl, onClose, onSaveUrl, onUpload }: ImageModalProps) {
  const [url, setUrl] = useState(currentUrl)
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setUrl(currentUrl)
    }
  }, [isOpen, currentUrl])

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
      onClose()
    }
  }

  const handleUrlSave = () => {
    onSaveUrl(url)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-surface-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-zinc-100">Adicionar Capa</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'url'
                ? 'bg-accent text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Link da Imagem
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'bg-accent text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Upload de Arquivo
          </button>
        </div>

        {activeTab === 'url' ? (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">URL da imagem</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-11 px-4 rounded-xl border border-zinc-700 bg-surface-800 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUrlSave}
                disabled={!url.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-12 rounded-xl border-2 border-dashed border-zinc-700 hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">Clique para selecionar uma imagem</span>
                <span className="text-xs text-zinc-500">PNG, JPG, GIF até 5MB</span>
              </div>
            </button>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface AiRewriteModalProps {
  isOpen: boolean
  instruction: string
  onInstructionChange: (value: string) => void
  onClose: () => void
  onRun: () => void
  isRunning: boolean
  error: string | null
}

function AiRewriteModal({
  isOpen,
  instruction,
  onInstructionChange,
  onClose,
  onRun,
  isRunning,
  error,
}: AiRewriteModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-surface-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-100">Editar com IA</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-zinc-400 mb-3">
          Descreva o que a IA deve fazer. A resposta substitui o conteúdo atual.
        </p>

        <textarea
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          placeholder="Ex.: Formate mantendo headings e melhore clareza sem mudar o sentido."
          className="w-full min-h-28 p-3 rounded-xl border border-zinc-700 bg-surface-800 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none resize-y"
        />

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={!instruction.trim() || isRunning}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? 'Aplicando...' : 'Aplicar IA'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function IdeaEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const { documents, isLoaded, getById, create, update, remove, syncRelations } = useDocuments()
  const { interests, areas } = useOrganization()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedInterest, setSelectedInterest] = useState('')
  const [selectedArea, setSelectedArea] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [cover, setCover] = useState('')
  const [showMetadata, setShowMetadata] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [isApplyingAi, setIsApplyingAi] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [hasChanges, setHasChanges] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)

  const availableAreas = useMemo(() => {
    if (!selectedInterest) return areas
    return areas.filter((a) => a.interestId === selectedInterest)
  }, [areas, selectedInterest])

  const currentInterest = useMemo(() => {
    return interests.find((i) => i.id === selectedInterest)
  }, [interests, selectedInterest])

  const currentArea = useMemo(() => {
    return areas.find((a) => a.id === selectedArea)
  }, [areas, selectedArea])

  useEffect(() => {
    if (!isNew && id) {
      const doc = getById(id)
      if (doc) {
        setTitle(doc.title)
        setContent(doc.content)
        setTags(doc.tags)
        setCover(doc.cover)

        const area = areas.find((a) => a.name === doc.area)
        if (area) {
          setSelectedArea(area.id)
          setSelectedInterest(area.interestId)
        }
      } else if (isLoaded) {
        navigate('/ideias')
      }
    }
  }, [isNew, id, getById, areas, navigate, isLoaded])

  useEffect(() => {
    if (isNew && interests.length > 0 && !selectedInterest) {
      setSelectedInterest(interests[0].id)
    }
  }, [isNew, interests, selectedInterest])

  useEffect(() => {
    if (!isNew || selectedArea || !selectedInterest) return

    const firstArea = areas.find((a) => a.interestId === selectedInterest)
    if (firstArea) {
      setSelectedArea(firstArea.id)
    }
  }, [isNew, selectedArea, selectedInterest, areas])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setHasChanges(true)
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
      setHasChanges(true)
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
    setHasChanges(true)
  }

  const handleUploadImage = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      setCover(reader.result as string)
      setHasChanges(true)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSave = async () => {
    if (!title.trim() || !selectedArea) return

    setSaveStatus('saving')

    const area = areas.find((a) => a.id === selectedArea)
    if (!area) {
      setSaveStatus('idle')
      return
    }

    const interest = interests.find((i) => i.id === selectedInterest)

    if (isNew) {
      const newDoc: DocumentCreate = {
        title: title.trim(),
        content,
        cover,
        interest: interest?.name || '',
        area: area.name,
        tags,
        relations: [],
      }
      const created = await create(newDoc)
      if (created) {
        await syncRelations(created.id, content)
        navigate(`/ideia/${created.id}`, { replace: true })
        setSaveStatus('saved')
        setHasChanges(false)
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    } else if (id) {
      await update(id, {
        title: title.trim(),
        content,
        cover,
        interest: interest?.name || '',
        area: area.name,
        tags,
      })
      await syncRelations(id, content)
      setSaveStatus('saved')
      setHasChanges(false)
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  const handleCancel = () => {
    navigate('/ideias')
  }

  const handleBack = () => {
    navigate('/ideias')
  }

  const handleDelete = async () => {
    if (isNew || !id) return

    const confirmed = window.confirm('Tem certeza que deseja excluir este documento? Essa ação não pode ser desfeita.')
    if (!confirmed) return

    const removed = await remove(id)
    if (removed) {
      navigate('/ideias', { replace: true })
      return
    }

    window.alert('Não foi possível excluir o documento. Tente novamente.')
  }

  const handleRunAiRewrite = async () => {
    if (!aiInstruction.trim() || !content.trim()) return

    setIsApplyingAi(true)
    setAiError(null)
    try {
      const rewritten = await rewriteContentWithAi({
        content,
        instruction: aiInstruction.trim(),
      })
      setContent(rewritten)
      setHasChanges(true)
      setShowAiModal(false)
      setAiInstruction('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar com IA.'
      setAiError(message)
    } finally {
      setIsApplyingAi(false)
    }
  }

  return (
    <div className="h-full bg-surface-950 overflow-auto">
      <div className="w-full max-w-none md:max-w-3xl md:mx-auto lg:max-w-4xl">
        {/* Header com opções de metadados */}
        <div className="sticky top-0 z-20 bg-surface-950/95 backdrop-blur-sm border-b border-zinc-800/50">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
                title="Voltar para ideias"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar
              </button>

              <button
                type="button"
                onClick={() => setShowMetadata(!showMetadata)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                  transition-colors
                  ${showMetadata ? 'bg-accent/20 text-accent' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
                `}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Propriedades
              </button>

              <button
                type="button"
                onClick={() => setShowImageModal(true)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                  transition-colors
                  ${cover ? 'bg-accent/20 text-accent' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
                `}
                title={cover ? 'Alterar capa' : 'Adicionar capa'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {cover ? 'Alterar capa' : 'Adicionar capa'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiError(null)
                  setShowAiModal(true)
                }}
                className="
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                  text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors
                "
                title="Formatar ou modificar conteúdo com IA"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3l1.912 5.813a1 1 0 00.95.688H21l-4.956 3.6a1 1 0 00-.364 1.118L17.59 20 12 16.4 6.41 20l1.91-5.781a1 1 0 00-.364-1.118L3 9.5h6.138a1 1 0 00.95-.688L12 3z"
                  />
                </svg>
                IA
              </button>

              {currentInterest && (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-800 text-xs text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
                  {currentInterest.name}
                  {currentArea && (
                    <>
                      <span className="text-zinc-600">/</span>
                      <span>{currentArea.name}</span>
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isNew && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  Excluir
                </button>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-xs">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Salvo
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 text-xs">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Salvando...
                </span>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!title.trim() || !selectedArea || !hasChanges || saveStatus === 'saving'}
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>

          {/* Painel de metadados expansível */}
          {showMetadata && (
            <div className="px-4 md:px-6 py-4 border-t border-zinc-800/50 bg-surface-900/30">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Interesse</label>
                  <select
                    value={selectedInterest}
                    onChange={(e) => {
                      const nextInterestId = e.target.value
                      const nextArea = areas.find((a) => a.interestId === nextInterestId)

                      setSelectedInterest(nextInterestId)
                      setSelectedArea(nextArea?.id ?? '')
                      setHasChanges(true)
                    }}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-700 bg-surface-800 text-sm text-zinc-200 focus:border-accent focus:outline-none"
                  >
                    {interests.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Área</label>
                  <select
                    value={selectedArea}
                    onChange={(e) => {
                      setSelectedArea(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-700 bg-surface-800 text-sm text-zinc-200 focus:border-accent focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {availableAreas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {cover && (
                <div className="mb-4">
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Capa atual</label>
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden">
                    <img src={cover} alt="Capa" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                      setCover('')
                      setHasChanges(true)
                    }}
                      className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white hover:bg-black/70 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Tags</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent/10 text-accent text-xs"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-white"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Nova tag..."
                      className="h-8 w-28 px-2 rounded-md border border-zinc-700 bg-surface-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                      className="h-8 px-2 rounded-md bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Conteúdo principal estilo Obsidian */}
        <div className="px-4 md:px-6 lg:px-8 py-6">
          {/* Capa */}
          {cover && (
            <div className="mb-8 rounded-xl overflow-hidden">
              <img
                src={cover}
                alt="Capa"
                className="w-full h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}

          {/* Título grande estilo Obsidian */}
          <div className="mb-6">
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => {
              setTitle(e.target.value)
              setHasChanges(true)
            }}
              placeholder="Título da ideia..."
              className="
                w-full bg-transparent border-none
                text-4xl font-bold text-zinc-100 placeholder:text-zinc-700
                focus:outline-none focus:ring-0
              "
            />
          </div>

          {/* Dicas de atalhos */}
          <div className="flex items-center gap-4 mb-6 text-zinc-600 text-xs">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-500">#</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-500">##</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-500">###</kbd>
              <span>para títulos</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-500">@</kbd>
              <span>para linkar ideias</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-500">Enter</kbd>
              <span>ou</span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-500">Tab</kbd>
              <span>para selecionar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-500">Backspace</kbd>
              <span>no início remove título</span>
            </span>
          </div>

          {/* Linha divisória */}
          <div className="border-b border-zinc-800 mb-6" />

          {/* Editor de conteúdo */}
          <div className="relative min-h-[400px]">
            <RichTextEditor
              content={content}
              onChange={handleContentChange}
              placeholder="Comece a escrever..."
              documents={documents}
              currentDocumentId={id}
            />
          </div>
        </div>
      </div>

      <ImageModal
        isOpen={showImageModal}
        currentUrl={cover}
        onClose={() => setShowImageModal(false)}
        onSaveUrl={(url) => {
          setCover(url)
          setHasChanges(true)
        }}
        onUpload={handleUploadImage}
      />

      <AiRewriteModal
        isOpen={showAiModal}
        instruction={aiInstruction}
        onInstructionChange={setAiInstruction}
        onClose={() => {
          if (isApplyingAi) return
          setShowAiModal(false)
          setAiError(null)
        }}
        onRun={handleRunAiRewrite}
        isRunning={isApplyingAi}
        error={aiError}
      />
    </div>
  )
}
