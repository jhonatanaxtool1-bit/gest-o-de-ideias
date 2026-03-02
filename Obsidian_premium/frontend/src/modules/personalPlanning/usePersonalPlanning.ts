import { useCallback, useMemo, useState } from 'react'
import {
  createPlanningCard,
  deletePlanningCard,
  getPlanningCards,
  updatePlanningCard,
} from './personalPlanningService'
import type {
  PlanningCard,
  PlanningCardCreateInput,
  PlanningCardUpdateInput,
  PlanningStatus,
} from './types'

type GroupedCards = Record<PlanningStatus, PlanningCard[]>

function createEmptyGroups(): GroupedCards {
  return {
    todo: [],
    doing: [],
    done: [],
    nostatus: [],
  }
}

export function usePersonalPlanning() {
  const [cards, setCards] = useState<PlanningCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCards = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getPlanningCards()
      setCards(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cards.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createCard = useCallback(async (input: PlanningCardCreateInput) => {
    setIsSaving(true)
    setError(null)
    try {
      const created = await createPlanningCard(input)
      setCards((prev) => [...prev, created])
      return created
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar card.')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [])

  const editCard = useCallback(async (id: string, input: PlanningCardUpdateInput) => {
    setIsSaving(true)
    setError(null)
    try {
      const updated = await updatePlanningCard(id, input)
      setCards((prev) => prev.map((item) => (item.id === id ? updated : item)))
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao editar card.')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [])

  const removeCard = useCallback(async (id: string) => {
    setIsSaving(true)
    setError(null)
    try {
      await deletePlanningCard(id)
      setCards((prev) => prev.filter((item) => item.id !== id))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir card.')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  const cardsByStatus = useMemo(() => {
    const groups = createEmptyGroups()
    for (const card of cards) {
      if (!card.isFinalized) groups[card.status].push(card)
    }
    return groups
  }, [cards])

  const finalizedCards = useMemo(() => {
    return cards
      .filter((card) => card.isFinalized)
      .sort((a, b) => {
        const aTime = a.completedAt ? Date.parse(a.completedAt) : 0
        const bTime = b.completedAt ? Date.parse(b.completedAt) : 0
        return bTime - aTime
      })
  }, [cards])

  const finalizeCard = useCallback(
    async (id: string) => {
      const finalizedAt = new Date().toISOString()
      return editCard(id, { status: 'done', isFinalized: true, completedAt: finalizedAt })
    },
    [editCard]
  )

  const reopenCard = useCallback(
    async (id: string) => {
      return editCard(id, { isFinalized: false, completedAt: null })
    },
    [editCard]
  )

  return {
    cards,
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
  }
}
