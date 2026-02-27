import type { Document } from '@/modules/documents/types'
import type { Area, Interest } from '@/modules/organization/types'
import type { IdeaGraphLink, IdeaGraphNode, TreeHierarchyNode } from './types'

type BuildGraphInput = {
  interests: Interest[]
  areas: Area[]
  documents: Document[]
}

type HierarchyBuildNode = TreeHierarchyNode & { _rank: number }

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function areaRank(type: IdeaGraphNode['type']): number {
  if (type === 'interesse') return 0
  if (type === 'area') return 1
  return 2
}

export function buildIdeaGraphData({ interests, areas, documents }: BuildGraphInput): {
  nodes: IdeaGraphNode[]
  links: IdeaGraphLink[]
} {
  const nodes: IdeaGraphNode[] = []
  const links: IdeaGraphLink[] = []
  const nodeIds = new Set<string>()
  const areaByName = new Map<string, Area>()
  const interestByName = new Map<string, Interest>()
  const areaById = new Map<string, Area>()

  for (const interest of interests) {
    const id = `interesse-${interest.id}`
    nodeIds.add(id)
    interestByName.set(normalize(interest.name), interest)
    nodes.push({
      id,
      type: 'interesse',
      parentId: null,
      title: interest.name,
      sourceId: interest.id,
      metadata: { createdAt: interest.createdAt },
    })
  }

  for (const area of areas) {
    const id = `area-${area.id}`
    const parentId = `interesse-${area.interestId}`
    nodeIds.add(id)
    areaByName.set(normalize(area.name), area)
    areaById.set(area.id, area)
    nodes.push({
      id,
      type: 'area',
      parentId,
      title: area.name,
      sourceId: area.id,
      metadata: { createdAt: area.createdAt },
    })
    links.push({
      id: `hierarchy-${parentId}-${id}`,
      source: parentId,
      target: id,
      kind: 'hierarchy',
    })
  }

  for (const doc of documents) {
    const area = areaByName.get(normalize(doc.area))
    const interest = interestByName.get(normalize(doc.interest))
    const areaParentId = area ? `area-${area.id}` : null
    const interestParentId = interest ? `interesse-${interest.id}` : null
    const parentId = areaParentId ?? interestParentId
    const id = `ideia-${doc.id}`
    nodeIds.add(id)

    nodes.push({
      id,
      type: 'ideia',
      parentId,
      title: doc.title,
      description: doc.content.slice(0, 280),
      sourceId: doc.id,
      metadata: {
        area: doc.area,
        interest: doc.interest,
        tags: doc.tags,
        createdAt: doc.createdAt,
      },
    })

    if (parentId) {
      links.push({
        id: `hierarchy-${parentId}-${id}`,
        source: parentId,
        target: id,
        kind: 'hierarchy',
      })
    }
  }

  const relationLinkIds = new Set<string>()
  for (const doc of documents) {
    const source = `ideia-${doc.id}`
    if (!nodeIds.has(source)) continue
    for (const relation of doc.relations) {
      const target = `ideia-${relation.targetId}`
      if (!nodeIds.has(target)) continue
      const left = source < target ? source : target
      const right = source < target ? target : source
      const relationId = `relation-${left}-${right}`
      if (relationLinkIds.has(relationId)) continue
      relationLinkIds.add(relationId)
      links.push({
        id: relationId,
        source,
        target,
        kind: 'relation',
      })
    }
  }

  return {
    nodes,
    links,
  }
}

export function toTreeHierarchy(nodes: IdeaGraphNode[]): TreeHierarchyNode {
  const childrenByParent = new Map<string | null, IdeaGraphNode[]>()
  for (const node of nodes) {
    const parentId = node.parentId
    const bucket = childrenByParent.get(parentId) ?? []
    bucket.push(node)
    childrenByParent.set(parentId, bucket)
  }

  const buildNode = (node: IdeaGraphNode): HierarchyBuildNode => {
    const children = (childrenByParent.get(node.id) ?? [])
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
      .map(buildNode)

    return {
      id: node.id,
      node,
      _rank: areaRank(node.type),
      children,
    }
  }

  const rootChildren = (childrenByParent.get(null) ?? [])
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    .map(buildNode)

  return {
    id: '__root__',
    node: {
      id: '__root__',
      type: 'interesse',
      parentId: null,
      title: 'Raiz',
      sourceId: '__root__',
    },
    children: rootChildren.map(({ _rank, ...rest }) => rest),
  }
}

export function filterTreeNodesByCollapsedAreas(
  nodes: IdeaGraphNode[],
  collapsedAreaIds: Set<string>
): IdeaGraphNode[] {
  if (collapsedAreaIds.size === 0) return nodes

  const byParent = new Map<string | null, IdeaGraphNode[]>()
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? []
    list.push(node)
    byParent.set(node.parentId, list)
  }

  const visible = new Map<string, IdeaGraphNode>()
  const visit = (parentId: string | null) => {
    const children = byParent.get(parentId) ?? []
    for (const child of children) {
      visible.set(child.id, child)
      if (child.type === 'area' && collapsedAreaIds.has(child.id)) continue
      visit(child.id)
    }
  }

  visit(null)
  return Array.from(visible.values())
}

export function getAreaChildrenCount(nodes: IdeaGraphNode[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const node of nodes) {
    if (node.type !== 'ideia' || !node.parentId) continue
    counts.set(node.parentId, (counts.get(node.parentId) ?? 0) + 1)
  }
  return counts
}
