import * as d3 from 'd3'
import type { IdeaGraphLink, IdeaGraphNode, LayoutResult } from '@/modules/ideasVisualization/types'

type ClusterLayoutOptions = {
  width: number
  height: number
}

type GroupDef = {
  key: IdeaGraphNode['type']
  title: string
}

const GROUPS: GroupDef[] = [
  { key: 'interesse', title: 'Interesses' },
  { key: 'area', title: 'Areas' },
  { key: 'ideia', title: 'Ideias' },
]

export function buildClusterLayout(nodes: IdeaGraphNode[], links: IdeaGraphLink[], options: ClusterLayoutOptions): LayoutResult {
  const width = Math.max(options.width, 320)
  const height = Math.max(options.height, 320)
  const leftPadding = 120
  const rightPadding = 120
  const topPadding = 120
  const bottomPadding = 90

  const groupX = d3
    .scalePoint<IdeaGraphNode['type']>()
    .domain(GROUPS.map((group) => group.key))
    .range([leftPadding, width - rightPadding])
    .padding(0.4)

  const labels = GROUPS.map((group) => ({
    id: `label-${group.key}`,
    title: group.title,
    x: groupX(group.key) ?? width / 2,
    y: 70,
  }))

  const hierarchyLinks = links.filter((entry) => entry.kind === 'hierarchy')
  const parentById = new Map<string, string>()
  for (const link of hierarchyLinks) {
    parentById.set(link.target, link.source)
  }

  const interests = nodes
    .filter((entry) => entry.type === 'interesse')
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  const interestOrder = new Map(interests.map((entry, index) => [entry.id, index]))

  const areas = nodes
    .filter((entry) => entry.type === 'area')
    .sort((a, b) => {
      const parentOrderA = interestOrder.get(parentById.get(a.id) ?? '') ?? Number.MAX_SAFE_INTEGER
      const parentOrderB = interestOrder.get(parentById.get(b.id) ?? '') ?? Number.MAX_SAFE_INTEGER
      if (parentOrderA !== parentOrderB) return parentOrderA - parentOrderB
      return a.title.localeCompare(b.title, 'pt-BR')
    })
  const areaOrder = new Map(areas.map((entry, index) => [entry.id, index]))

  const ideas = nodes
    .filter((entry) => entry.type === 'ideia')
    .sort((a, b) => {
      const parentOrderA = areaOrder.get(parentById.get(a.id) ?? '') ?? Number.MAX_SAFE_INTEGER
      const parentOrderB = areaOrder.get(parentById.get(b.id) ?? '') ?? Number.MAX_SAFE_INTEGER
      if (parentOrderA !== parentOrderB) return parentOrderA - parentOrderB
      return a.title.localeCompare(b.title, 'pt-BR')
    })

  const orderedByType: Record<IdeaGraphNode['type'], IdeaGraphNode[]> = {
    interesse: interests,
    area: areas,
    ideia: ideas,
  }

  const yById = new Map<string, number>()
  for (const group of GROUPS) {
    const groupNodes = orderedByType[group.key]
    const yScale = d3
      .scalePoint<string>()
      .domain(groupNodes.map((entry) => entry.id))
      .range([topPadding, height - bottomPadding])
      .padding(0.55)

    for (const node of groupNodes) {
      yById.set(node.id, yScale(node.id) ?? height / 2)
    }
  }

  const positionedNodes = nodes.map((node) => ({
    ...node,
    x: groupX(node.type) ?? width / 2,
    y: yById.get(node.id) ?? height / 2,
  }))

  return {
    nodes: positionedNodes,
    links: hierarchyLinks,
    labels,
  }
}
