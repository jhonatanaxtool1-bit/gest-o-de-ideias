import type { Interest, Area } from '@/modules/organization/types'

const INTERESTS = '/api/interests'
const AREAS = '/api/areas'

async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function fetchInterests(): Promise<Interest[]> {
  const res = await fetch(INTERESTS)
  return (await handleResponse(res)) as Interest[]
}

export async function createInterestApi(i: Interest): Promise<Interest> {
  const res = await fetch(INTERESTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(i),
  })
  return (await handleResponse(res)) as Interest
}

export async function updateInterestApi(id: string, name: string): Promise<Interest> {
  const res = await fetch(`${INTERESTS}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return (await handleResponse(res)) as Interest
}

export async function deleteInterestApi(id: string): Promise<void> {
  const res = await fetch(`${INTERESTS}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await handleResponse(res)
}

export async function fetchAreas(): Promise<Area[]> {
  const res = await fetch(AREAS)
  return (await handleResponse(res)) as Area[]
}

export async function createAreaApi(a: Area): Promise<Area> {
  const res = await fetch(AREAS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(a),
  })
  return (await handleResponse(res)) as Area
}

export async function updateAreaApi(id: string, name: string): Promise<Area> {
  const res = await fetch(`${AREAS}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return (await handleResponse(res)) as Area
}

export async function deleteAreaApi(id: string): Promise<void> {
  const res = await fetch(`${AREAS}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await handleResponse(res)
}

