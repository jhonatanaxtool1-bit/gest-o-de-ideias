import type { IdeaGraphNode } from '@/modules/ideasVisualization/types'

export function getNodeRadius(type: IdeaGraphNode['type']): number {
  if (type === 'interesse') return 24
  if (type === 'area') return 18
  return 13
}

export function getNodeTypeLabel(type: IdeaGraphNode['type']): string {
  if (type === 'interesse') return 'Interesse'
  if (type === 'area') return 'Area'
  return 'Ideia'
}

export const NODE_TYPE_COLOR: Record<IdeaGraphNode['type'], string> = {
  interesse: '#7c8aff',
  area: '#34d399',
  ideia: '#a1a1aa',
}

export const NODE_TYPE_STROKE: Record<IdeaGraphNode['type'], string> = {
  interesse: '#a5b4fc',
  area: '#6ee7b7',
  ideia: '#d4d4d8',
}
