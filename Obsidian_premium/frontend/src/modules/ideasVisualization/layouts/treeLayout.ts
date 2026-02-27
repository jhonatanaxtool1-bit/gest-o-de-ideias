import * as d3 from 'd3'
import { toTreeHierarchy } from '@/modules/ideasVisualization/graphData'
import type { IdeaGraphLink, IdeaGraphNode, LayoutResult } from '@/modules/ideasVisualization/types'

type TreeLayoutOptions = {
  width: number
  height: number
}

export function buildTreeLayout(nodes: IdeaGraphNode[], links: IdeaGraphLink[], options: TreeLayoutOptions): LayoutResult {
  const margin = 96
  const width = Math.max(options.width, 320)
  const height = Math.max(options.height, 320)
  const hierarchyRoot = toTreeHierarchy(nodes)
  const tree = d3.tree<typeof hierarchyRoot>().nodeSize([110, 180])

  const root = d3.hierarchy(hierarchyRoot, (entry) => entry.children)
  tree(root)

  const all = root.descendants().filter((entry) => entry.data.id !== '__root__')
  if (all.length === 0) return { nodes: [], links: [] }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = 0
  for (const entry of all) {
    const x = entry.x ?? 0
    const y = entry.y ?? 0
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY)
  const drawWidth = Math.max(1, width - margin * 2)
  const drawHeight = Math.max(1, height - margin * 2)
  const scaleX = drawWidth / spanX
  const scaleY = drawHeight / spanY
  const scale = Math.min(1, scaleX, scaleY)
  const centeredOffsetX = (drawWidth - spanX * scale) / 2

  const nodePositions = new Map<string, { x: number; y: number }>()
  const layoutNodes = all.map((entry) => {
    const x = margin + centeredOffsetX + ((entry.x ?? 0) - minX) * scale
    const y = margin + (entry.y ?? 0) * scale
    nodePositions.set(entry.data.id, { x, y })
    return {
      ...entry.data.node,
      x,
      y,
    }
  })

  const layoutLinks = links.filter((link) => {
    if (link.kind !== 'hierarchy') return false
    return nodePositions.has(link.source) && nodePositions.has(link.target)
  })

  return {
    nodes: layoutNodes,
    links: layoutLinks,
  }
}
