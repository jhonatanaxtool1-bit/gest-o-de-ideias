import type { Area, Interest } from './types'
import { fetchInterests, createInterestApi, updateInterestApi, deleteInterestApi, fetchAreas, createAreaApi, updateAreaApi, deleteAreaApi } from '@/api/organizationApi'

const INTERESTS_KEY = 'obsidian-premium-interests'
const AREAS_KEY = 'obsidian-premium-areas'

function now(): string {
  return new Date().toISOString()
}

function genId(): string {
  return crypto.randomUUID()
}

function normalizeInterests(value: unknown): Interest[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Partial<Interest> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : genId(),
      name: typeof item.name === 'string' ? item.name : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now(),
    }))
    .filter((item) => item.name.trim().length > 0)
}

function normalizeAreas(value: unknown): Area[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Partial<Area> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : genId(),
      name: typeof item.name === 'string' ? item.name : '',
      interestId: typeof item.interestId === 'string' ? item.interestId : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now(),
    }))
    .filter((item) => item.name.trim().length > 0 && item.interestId.trim().length > 0)
}

export function loadInterests(): Interest[] {
  try {
    const raw = localStorage.getItem(INTERESTS_KEY)
    if (!raw) return []
    return normalizeInterests(JSON.parse(raw))
  } catch {
    return []
  }
}

export function saveInterests(interests: Interest[]): void {
  localStorage.setItem(INTERESTS_KEY, JSON.stringify(interests))

  ;(async () => {
    try {
      const server = await fetchInterests().catch(() => [])
      const serverById = new Map(server.map((s) => [s.id, s]))
      const localById = new Map(interests.map((i) => [i.id, i]))

      for (const item of interests) {
        if (serverById.has(item.id)) {
          try {
            await updateInterestApi(item.id, item.name)
          } catch {}
        } else {
          try {
            await createInterestApi(item)
          } catch {}
        }
      }

      for (const s of server) {
        if (!localById.has(s.id)) {
          try {
            await deleteInterestApi(s.id)
          } catch {}
        }
      }
    } catch {
      // best-effort
    }
  })()
}

export function loadAreas(): Area[] {
  try {
    const raw = localStorage.getItem(AREAS_KEY)
    if (!raw) return []
    return normalizeAreas(JSON.parse(raw))
  } catch {
    return []
  }
}

export function saveAreas(areas: Area[]): void {
  localStorage.setItem(AREAS_KEY, JSON.stringify(areas))

  ;(async () => {
    try {
      const server = await fetchAreas().catch(() => [])
      const serverById = new Map(server.map((s) => [s.id, s]))
      const localById = new Map(areas.map((a) => [a.id, a]))

      for (const item of areas) {
        if (serverById.has(item.id)) {
          try {
            await updateAreaApi(item.id, item.name)
          } catch {}
        } else {
          try {
            await createAreaApi(item)
          } catch {}
        }
      }

      for (const s of server) {
        if (!localById.has(s.id)) {
          try {
            await deleteAreaApi(s.id)
          } catch {}
        }
      }
    } catch {
      // best-effort
    }
  })()
}

export function ensureOrganizationSeed(): { interests: Interest[]; areas: Area[] } {
  let interests = loadInterests()
  let areas = loadAreas()

  if (interests.length === 0) {
    const personalId = genId()
    interests = [{ id: personalId, name: 'Pessoal', createdAt: now() }]
    saveInterests(interests)
    areas = [
      { id: genId(), name: 'Inbox', interestId: personalId, createdAt: now() },
      { id: genId(), name: 'Áreas', interestId: personalId, createdAt: now() },
    ]
    saveAreas(areas)
    return { interests, areas }
  }

  const interestIds = new Set(interests.map((item) => item.id))
  const filteredAreas = areas.filter((item) => interestIds.has(item.interestId))
  if (filteredAreas.length !== areas.length) {
    areas = filteredAreas
    saveAreas(areas)
  }

  return { interests, areas }
}

export function createInterest(name: string): Interest {
  const cleaned = name.trim()
  const interests = loadInterests()
  const interest: Interest = {
    id: genId(),
    name: cleaned,
    createdAt: now(),
  }
  interests.push(interest)
  saveInterests(interests)
  return interest
}

export function createArea(name: string, interestId: string): Area {
  const cleaned = name.trim()
  const areas = loadAreas()
  const area: Area = {
    id: genId(),
    name: cleaned,
    interestId,
    createdAt: now(),
  }
  areas.push(area)
  saveAreas(areas)
  return area
}

export function deleteInterest(interestId: string): boolean {
  const interests = loadInterests()
  const filteredInterests = interests.filter((i) => i.id !== interestId)

  if (filteredInterests.length === interests.length) return false

  saveInterests(filteredInterests)

  const areas = loadAreas()
  const filteredAreas = areas.filter((a) => a.interestId !== interestId)
  saveAreas(filteredAreas)

  return true
}

export function deleteArea(areaId: string): boolean {
  const areas = loadAreas()
  const filteredAreas = areas.filter((a) => a.id !== areaId)

  if (filteredAreas.length === areas.length) return false

  saveAreas(filteredAreas)
  return true
}

export function updateInterest(id: string, name: string): Interest | null {
  const interests = loadInterests()
  const index = interests.findIndex((i) => i.id === id)

  if (index === -1) return null

  const cleaned = name.trim()
  if (!cleaned) return null

  interests[index] = { ...interests[index], name: cleaned }
  saveInterests(interests)
  return interests[index]
}

export function updateArea(id: string, name: string): Area | null {
  const areas = loadAreas()
  const index = areas.findIndex((a) => a.id === id)

  if (index === -1) return null

  const cleaned = name.trim()
  if (!cleaned) return null

  areas[index] = { ...areas[index], name: cleaned }
  saveAreas(areas)
  return areas[index]
}
