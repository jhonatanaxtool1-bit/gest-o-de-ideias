import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createAreaApi,
  createInterestApi,
  deleteAreaApi,
  deleteInterestApi,
  fetchAreas,
  fetchInterests,
  updateAreaApi,
  updateInterestApi,
} from '@/api/organizationApi'
import type { Area, Interest } from './types'

export function useOrganization() {
  const [interests, setInterests] = useState<Interest[]>([])
  const [areas, setAreas] = useState<Area[]>([])

  const refresh = useCallback(async () => {
    const [nextInterests, nextAreas] = await Promise.all([fetchInterests(), fetchAreas()])
    setInterests(nextInterests)
    setAreas(nextAreas)
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const addInterest = useCallback(async (name: string): Promise<Interest | null> => {
    const cleaned = name.trim()
    if (!cleaned) return null
    const duplicate = interests.some((item) => item.name.trim().toLowerCase() === cleaned.toLowerCase())
    if (duplicate) return null

    const created = await createInterestApi({
      id: crypto.randomUUID(),
      name: cleaned,
      createdAt: new Date().toISOString(),
    })
    setInterests((prev) => [...prev, created])
    return created
  }, [interests])

  const addArea = useCallback(async (name: string, interestId: string): Promise<Area | null> => {
    const cleaned = name.trim()
    if (!cleaned || !interestId) return null
    const duplicate = areas.some((item) =>
      item.interestId === interestId && item.name.trim().toLowerCase() === cleaned.toLowerCase()
    )
    if (duplicate) return null

    const created = await createAreaApi({
      id: crypto.randomUUID(),
      name: cleaned,
      interestId,
      createdAt: new Date().toISOString(),
    })
    setAreas((prev) => [...prev, created])
    return created
  }, [areas])

  const removeInterest = useCallback(async (interestId: string): Promise<boolean> => {
    await deleteInterestApi(interestId)
    setInterests((prev) => prev.filter((item) => item.id !== interestId))
    setAreas((prev) => prev.filter((item) => item.interestId !== interestId))
    return true
  }, [])

  const removeArea = useCallback(async (areaId: string): Promise<boolean> => {
    await deleteAreaApi(areaId)
    setAreas((prev) => prev.filter((item) => item.id !== areaId))
    return true
  }, [])

  const editInterest = useCallback(async (id: string, name: string): Promise<Interest | null> => {
    const cleaned = name.trim()
    if (!cleaned) return null
    const duplicate = interests.some(
      (item) => item.id !== id && item.name.trim().toLowerCase() === cleaned.toLowerCase()
    )
    if (duplicate) return null

    const updated = await updateInterestApi(id, cleaned)
    setInterests((prev) => prev.map((item) => (item.id === id ? updated : item)))
    return updated
  }, [interests])

  const editArea = useCallback(async (id: string, name: string): Promise<Area | null> => {
    const cleaned = name.trim()
    if (!cleaned) return null
    const area = areas.find((a) => a.id === id)
    if (!area) return null
    const duplicate = areas.some(
      (item) =>
        item.id !== id &&
        item.interestId === area.interestId &&
        item.name.trim().toLowerCase() === cleaned.toLowerCase()
    )
    if (duplicate) return null

    const updated = await updateAreaApi(id, cleaned)
    setAreas((prev) => prev.map((item) => (item.id === id ? updated : item)))
    return updated
  }, [areas])

  const areasByInterestId = useMemo(() => {
    const map = new Map<string, Area[]>()
    for (const item of areas) {
      const bucket = map.get(item.interestId) ?? []
      bucket.push(item)
      map.set(item.interestId, bucket)
    }
    return map
  }, [areas])

  return {
    interests,
    areas,
    areasByInterestId,
    addInterest,
    addArea,
    removeInterest,
    removeArea,
    editInterest,
    editArea,
    refresh,
  }
}
