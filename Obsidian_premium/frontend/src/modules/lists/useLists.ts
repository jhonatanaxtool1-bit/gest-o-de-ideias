import { useCallback, useEffect, useState } from 'react'
import type { List, ListItem } from './types'
import {
  addListItemApi,
  createListApi,
  deleteListApi,
  deleteListItemApi,
  fetchLists,
  fetchListById,
  updateListApi,
  updateListItemApi,
} from '@/api/listsApi'
import { uuid } from '@/utils/uuid'

export function useLists() {
  const [lists, setLists] = useState<List[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchLists()
      setLists(data)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const getById = useCallback(
    async (id: string): Promise<List | null> => {
      try {
        return await fetchListById(id)
      } catch {
        return null
      }
    },
    []
  )

  const create = useCallback(
    async (input: { title: string; listType: string; items?: { label: string }[] }): Promise<List | null> => {
      const now = new Date().toISOString()
      const listId = uuid()
      const items = (input.items || []).map((it, index) => ({
        id: uuid(),
        label: it.label || '',
        order: index,
        done: false,
        createdAt: now,
      }))
      const created = await createListApi({
        id: listId,
        title: input.title || 'Sem título',
        listType: input.listType || 'geral',
        createdAt: now,
        updatedAt: now,
        items,
      })
      setLists((prev) => [created, ...prev])
      return created
    },
    []
  )

  const update = useCallback(async (id: string, payload: { title?: string; listType?: string; items?: ListItem[] }): Promise<List | undefined> => {
    const updated = await updateListApi(id, payload)
    setLists((prev) => prev.map((l) => (l.id === id ? updated : l)))
    return updated
  }, [])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    await deleteListApi(id)
    setLists((prev) => prev.filter((l) => l.id !== id))
    return true
  }, [])

  const toggleItemDone = useCallback(async (listId: string, itemId: string, done: boolean): Promise<void> => {
    await updateListItemApi(listId, itemId, { done })
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list
        return {
          ...list,
          items: list.items.map((it) => (it.id === itemId ? { ...it, done } : it)),
          updatedAt: new Date().toISOString(),
        }
      })
    )
  }, [])

  const addItem = useCallback(async (listId: string, label: string): Promise<ListItem | null> => {
    const list = lists.find((l) => l.id === listId)
    const order = list ? list.items.length : 0
    const item = await addListItemApi(listId, {
      id: uuid(),
      label,
      order,
      done: false,
      createdAt: new Date().toISOString(),
    })
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, items: [...l.items, item], updatedAt: new Date().toISOString() } : l))
    )
    return item
  }, [lists])

  const updateItemLabel = useCallback(async (listId: string, itemId: string, label: string): Promise<void> => {
    await updateListItemApi(listId, itemId, { label })
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list
        return {
          ...list,
          items: list.items.map((it) => (it.id === itemId ? { ...it, label } : it)),
          updatedAt: new Date().toISOString(),
        }
      })
    )
  }, [])

  const removeItem = useCallback(async (listId: string, itemId: string): Promise<void> => {
    await deleteListItemApi(listId, itemId)
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list
        return {
          ...list,
          items: list.items.filter((it) => it.id !== itemId),
          updatedAt: new Date().toISOString(),
        }
      })
    )
  }, [])

  return {
    lists,
    isLoaded,
    refresh,
    getById,
    create,
    update,
    remove,
    toggleItemDone,
    addItem,
    updateItemLabel,
    removeItem,
  }
}
