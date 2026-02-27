import * as d3 from 'd3'
import type { IdeaGraphLink, IdeaGraphNode, LayoutResult } from '@/modules/ideasVisualization/types'

type ForceLayoutOptions = {
  width: number
  height: number
}

function nodeRadius(type: IdeaGraphNode['type']): number {
  if (type === 'interesse') return 34
  if (type === 'area') return 24
  return 16
}

export function buildForceLayout(nodes: IdeaGraphNode[], links: IdeaGraphLink[], options: ForceLayoutOptions): LayoutResult {
  const width = Math.max(options.width, 320)
  const height = Math.max(options.height, 320)
  const margin = 80
  type LocalNode = IdeaGraphNode & d3.SimulationNodeDatum
  type LocalLink = IdeaGraphLink & d3.SimulationLinkDatum<LocalNode>

  const localNodes: LocalNode[] = nodes.map((node) => ({ ...node, x: width / 2, y: height / 2 }))
  const localLinks: LocalLink[] = links.map((link) => ({ ...link }))

  const simulation = d3
    .forceSimulation(localNodes)
    .force(
      'link',
      d3
        .forceLink<LocalNode, LocalLink>(localLinks)
        .id((entry) => entry.id)
        .distance((link) => (link.kind === 'hierarchy' ? 130 : 190))
        .strength((link) => (link.kind === 'hierarchy' ? 0.35 : 0.12))
    )
    .force(
      'charge',
      d3.forceManyBody().strength((entry) => {
        const node = entry as LocalNode
        return node.type === 'interesse' ? -1050 : node.type === 'area' ? -640 : -370
      })
    )
    .force(
      'collision',
      d3
        .forceCollide()
        .radius((entry) => nodeRadius((entry as LocalNode).type) + 6)
        .strength(0.95)
    )
    .force('x', d3.forceX(width / 2).strength(0.06))
    .force('y', d3.forceY(height / 2).strength(0.06))
    .alpha(1)
    .alphaDecay(0.028)

  for (let i = 0; i < 280; i += 1) simulation.tick()
  simulation.stop()

  const positionedNodes = localNodes.map((node) => ({
    ...node,
    x: Math.max(margin, Math.min(width - margin, node.x ?? width / 2)),
    y: Math.max(margin, Math.min(height - margin, node.y ?? height / 2)),
  }))

  return {
    nodes: positionedNodes,
    links,
  }
}
